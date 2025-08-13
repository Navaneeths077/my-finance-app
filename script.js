const months = ["All","January","February","March","April","May","June","July","August","September","October","November","December"];
const currentMonth = new Date().getMonth() + 1;
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

// Default date & time in IST
function getISTDateTimeLocal() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istOffset = 5.5 * 60 * 60000;
    const istTime = new Date(utc + istOffset);
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
document.getElementById("dateTime").value = getISTDateTimeLocal();

// --- Google Apps Script Web App URL ---
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx-GoT3gGPq7y46MZTMe_m-QDu8yV4tQT8vLyY7QBVizvYoUCx_tqOBYQek0F5vduZY/exec'; // replace with your Apps Script URL

// ==== Added: spinner helpers ====
function showSpinner(){ const el = document.getElementById("loadingSpinner"); if(el) el.style.display = "flex"; }
function hideSpinner(){ const el = document.getElementById("loadingSpinner"); if(el) el.style.display = "none"; }

// Load transactions from Drive
async function loadTransactionsFromDrive() {
    try {
        const res = await fetch(WEB_APP_URL);
        const data = await res.json();
        if (data.status === "success") {
            return data.transactions || [];
        } else {
            console.error(data.message);
            return [];
        }
    } catch(err) {
        console.error(err);
        return [];
    }
}

// Save transactions to Drive
async function saveTransactionsToDrive(transactions) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(transactions)
        });
    } catch(err) {
        console.error(err);
        alert("Error connecting to Drive!");
    }
}

// Add Transaction
document.getElementById("addBtn").addEventListener("click", async () => {
    const dateTime = document.getElementById("dateTime").value;
    const type = document.getElementById("type").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const remarks = document.getElementById("remarks").value.trim();

    if (!dateTime || !type || !amount || amount <= 0) {
        return alert("Please fill valid Date/Time, Type and Amount.");
    }

    showSpinner();
    try {
        let transactions = await loadTransactionsFromDrive();
        transactions.push({dateTime, type, amount, remarks});
        await saveTransactionsToDrive(transactions);

        document.getElementById("type").value = "Credit";
        document.getElementById("amount").value = "";
        document.getElementById("remarks").value = "";
        document.getElementById("dateTime").value = getISTDateTimeLocal();

        alert("Transaction Added!");
        await updateTransactionList();
    } catch (e) {
        console.error(e);
        alert("Something went wrong while saving.");
    } finally {
        hideSpinner();
    }
});

// --- Transaction List & Pie Chart ---
let pieChart;

async function updateTransactionList() {
    showSpinner();
    try {
        let transactions = await loadTransactionsFromDrive();

        const monthFilter = document.getElementById("filterMonth").value;
        const yearFilter = document.getElementById("filterYear").value;
        const fromDate = document.getElementById("fromDate").value;
        const toDate = document.getElementById("toDate").value;
        const remarksFilter = document.getElementById("filterRemarks")?.value.trim().toLowerCase() || "";

        const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
        const to = toDate ? new Date(toDate + "T23:59:59") : null;

        transactions = transactions.filter(t => {
            const tDate = new Date(t.dateTime);
            const remark = (t.remarks || "").toLowerCase();

            if (from && tDate < from) return false;
            if (to && tDate > to) return false;

            if (monthFilter !== "All") {
                const monthIndex = months.indexOf(monthFilter) - 1;
                if (tDate.getMonth() !== monthIndex) return false;
            }

            if (yearFilter !== "All" && tDate.getFullYear() != yearFilter) return false;

            if (remarksFilter !== "" && !remark.includes(remarksFilter)) return false;

            return true;
        });

        let totalCredit = 0;
        let totalDebit = 0;
        transactions.forEach(t => t.type === "Credit" ? totalCredit += t.amount : totalDebit += t.amount);

        const net = totalCredit - totalDebit;

        document.getElementById("sumCredit").textContent = `Total Credit: ₹${totalCredit.toFixed(2)}`;
        document.getElementById("sumDebit").textContent = `Total Debit: ₹${totalDebit.toFixed(2)}`;
        document.getElementById("sumNet").textContent = `Net: ₹${Math.abs(net).toFixed(2)} ${net >= 0 ? "Cr" : "Dr"}`;

        const pieContainer = document.getElementById('pieChartContainer');
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
            data: { labels: ['Credit','Debit'], datasets: [{ data: [totalCredit, totalDebit], backgroundColor: ['green','red'], hoverOffset:20 }] },
            options: { plugins: { legend: { position: 'bottom' } } }
        });

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
        } else {
            transactions.forEach((t, idx) => {
                const tr = document.createElement("tr");
                tr.className = t.type.toLowerCase();
                const dateStr = new Date(t.dateTime).toLocaleString();

                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td>${t.type}</td>
                    <td>₹${t.amount.toFixed(2)}</td>
                    <td>${t.remarks || "-"}</td>
                    <td><button class="deleteBtn" data-index="${idx}">Delete</button></td>
                `;

                tbody.appendChild(tr);
            });

            // Delete handlers
            document.querySelectorAll(".deleteBtn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const idx = e.target.getAttribute("data-index");
                    if(confirm("Are you sure you want to delete this transaction?")){
                        // Show spinner for save + refresh (updateTransactionList will also keep it visible)
                        showSpinner();
                        try {
                            // Reload all, remove by index from the current filtered list basis
                            let all = await loadTransactionsFromDrive();
                            // Remove the item by matching the filtered view's item
                            // Simpler approach: remove by index from filtered snapshot we already have:
                            transactions.splice(idx, 1);
                            await saveTransactionsToDrive(transactions);
                        } catch (err) {
                            console.error(err);
                            alert("Failed to delete the transaction.");
                        }
                        // Refresh list (will handle spinner visibility)
                        await updateTransactionList();
                    }
                });
            });
        }
    } catch (err) {
        console.error(err);
        alert("Failed to load transactions.");
    } finally {
        hideSpinner();
    }
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
