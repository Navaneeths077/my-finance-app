const months = ["All","January","February","March","April","May","June","July","August","September","October","November","December"];
const currentMonth = new Date().getMonth() + 1; // +1 because index 0 is "All"
const currentYear = new Date().getFullYear();

function populateDropdown(id, options, selected) {
    const select = document.getElementById(id);
    select.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (selected !== undefined && selected == opt) option.selected = true;
        select.appendChild(option);
    });
}

const years = ["All"];
for (let y = currentYear - 5; y <= currentYear + 5; y++) years.push(y);

["filterMonth"].forEach(id => populateDropdown(id, months, months[currentMonth]));
["filterYear"].forEach(id => populateDropdown(id, years, currentYear));

// Tab switching
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
        document.getElementById(btn.dataset.tab).classList.add("active");
        if (btn.dataset.tab === "all-transactions") updateTransactionList();
    });
});

// Set default date & time for Add Transaction to current date/time in local ISO format without seconds
function getISTDateTimeLocal() {
    const now = new Date();

    // Convert current time to UTC + 5:30 (IST)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istOffset = 5.5 * 60 * 60000; // 5 hours 30 minutes in milliseconds
    const istTime = new Date(utc + istOffset);

    // Format YYYY-MM-DDTHH:mm for datetime-local input
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Set default dateTime input value to current IST time
document.getElementById("dateTime").value = getISTDateTimeLocal();


// Add Transaction
document.getElementById("addBtn").addEventListener("click", () => {
    const dateTime = document.getElementById("dateTime").value;
    const type = document.getElementById("type").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const remarks = document.getElementById("remarks").value.trim();

    if (!dateTime || !type || !amount || amount <= 0) {
        return alert("Please fill valid Date/Time, Type and Amount.");
    }

    const transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
    transactions.push({dateTime, type, amount, remarks});
    localStorage.setItem("transactions", JSON.stringify(transactions));

    // Reset form fields except dateTime (keep current)
    document.getElementById("type").value = "Credit";
    document.getElementById("amount").value = "";
    document.getElementById("remarks").value = "";
    document.getElementById("dateTime").value = getISTDateTimeLocal();

    alert("Transaction Added!");
});

// Chart instance variable
let pieChart;

// Updated updateTransactionList with combined filters:
function updateTransactionList() {
    let transactions = JSON.parse(localStorage.getItem("transactions") || "[]");

    // Get filter values
    const monthFilter = document.getElementById("filterMonth").value;
    const yearFilter = document.getElementById("filterYear").value;
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;
    const remarksFilter = document.getElementById("filterRemarks")?.value.trim().toLowerCase() || "";

    // Prepare Date objects for fromDate and toDate
    const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
    const to = toDate ? new Date(toDate + "T23:59:59") : null;

    // Filter applying all conditions together
    transactions = transactions.filter(t => {
        const tDate = new Date(t.dateTime);
        const remark = (t.remarks || "").toLowerCase();

        if (from && tDate < from) return false;
        if (to && tDate > to) return false;

        if (monthFilter !== "All") {
            const monthIndex = months.indexOf(monthFilter) - 1; // months[0] = "All"
            if (tDate.getMonth() !== monthIndex) return false;
        }

        if (yearFilter !== "All" && tDate.getFullYear() != yearFilter) return false;

        if (remarksFilter !== "" && !remark.includes(remarksFilter)) return false;

        return true;
    });

    // Calculate totals for summary and pie chart
    let totalCredit = 0;
    let totalDebit = 0;

    transactions.forEach(t => {
        if(t.type === "Credit") totalCredit += t.amount;
        else totalDebit += t.amount;
    });

    const net = totalCredit - totalDebit;

    // Update summary box
    document.getElementById("sumCredit").textContent = `Total Credit: ₹${totalCredit.toFixed(2)}`;
    document.getElementById("sumDebit").textContent = `Total Debit: ₹${totalDebit.toFixed(2)}`;
    document.getElementById("sumNet").textContent = `Net: ₹${Math.abs(net).toFixed(2)} ${net >= 0 ? "Cr" : "Dr"}`;

    // Update pie chart
    const pieCtx = document.getElementById('pieChart');
    let pieContainer = document.getElementById('pieChartContainer');
    if(!document.getElementById('pieChart')){
        const canvas = document.createElement('canvas');
        canvas.id = 'pieChart';
        canvas.width = 250;
        canvas.height = 250;
        pieContainer.appendChild(canvas);
    }

    if(pieChart) pieChart.destroy();

    pieChart = new Chart(document.getElementById('pieChart').getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['Credit', 'Debit'],
            datasets: [{
                data: [totalCredit, totalDebit],
                backgroundColor: ['green', 'red'],
                hoverOffset: 20
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Clear and populate table
    const tbody = document.getElementById("transactionsList");
    tbody.innerHTML = "";

    if(transactions.length === 0){
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.style.textAlign = "center";
        td.textContent = "No transactions found";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    transactions.forEach((t, idx) => {
        const tr = document.createElement("tr");
        tr.className = t.type.toLowerCase();

        // Date & Time formatted
        const date = new Date(t.dateTime);
        const dateStr = date.toLocaleString();

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${t.type}</td>
            <td>₹${t.amount.toFixed(2)}</td>
            <td>${t.remarks || "-"}</td>
            <td><button class="deleteBtn" data-index="${idx}">Delete</button></td>
        `;

        tbody.appendChild(tr);
    });

    // Attach delete event listeners
    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = e.target.getAttribute("data-index");
            if(confirm("Are you sure you want to delete this transaction?")){
                let allTx = JSON.parse(localStorage.getItem("transactions") || "[]");

                const txToRemove = transactions[idx];
                const realIndex = allTx.findIndex(tx =>
                    tx.dateTime === txToRemove.dateTime &&
                    tx.type === txToRemove.type &&
                    tx.amount === txToRemove.amount &&
                    tx.remarks === txToRemove.remarks
                );

                if(realIndex > -1){
                    allTx.splice(realIndex, 1);
                    localStorage.setItem("transactions", JSON.stringify(allTx));
                    updateTransactionList();
                }
            }
        });
    });
}

// Filters buttons
document.getElementById("filterBtn").addEventListener("click", updateTransactionList);
document.getElementById("clearFilterBtn").addEventListener("click", () => {
    document.getElementById("filterMonth").value = "All";
    document.getElementById("filterYear").value = "All";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    document.getElementById("filterRemarks").value = "";
    updateTransactionList();
});

// Initial load
updateTransactionList();
