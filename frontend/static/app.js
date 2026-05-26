async function fetchStats() {
    try {
        const response = await fetch("/api/stats");
        const data = await response.json();

        document.getElementById("totalCount").textContent = data.total;
        document.getElementById("authorizedCount").textContent = data.authorized;
        document.getElementById("unauthorizedCount").textContent = data.unauthorized;
    } catch (error) {
        console.error("İstatistikler alınamadı:", error);
    }
}

async function fetchEvents() {
    try {
        const response = await fetch("/api/events");
        const events = await response.json();

        const table = document.getElementById("eventsTable");
        table.innerHTML = "";

        if (events.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">Henüz kayıt yok.</td>
                </tr>
            `;
            return;
        }

        events.forEach(event => {
            const row = document.createElement("tr");

            const statusText = event.status === "authorized"
                ? "Yetkili"
                : "Yetkisiz";

            const badgeClass = event.status === "authorized"
                ? "authorized"
                : "unauthorized";

            row.innerHTML = `
                <td>${event.id}</td>
                <td>${event.uid}</td>
                <td>
                    <span class="badge ${badgeClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${event.message || "-"}</td>
                <td>${event.created_at}</td>
            `;

            table.appendChild(row);
        });

        document.getElementById("lastUpdate").textContent =
            "Son güncelleme: " + new Date().toLocaleTimeString("tr-TR");

    } catch (error) {
        console.error("Olaylar alınamadı:", error);
    }
}

async function createTestEvent() {
    try {
        await fetch("/api/test", {
            method: "POST"
        });

        await refreshDashboard();
    } catch (error) {
        console.error("Test kaydı oluşturulamadı:", error);
    }
}

async function refreshDashboard() {
    await fetchStats();
    await fetchEvents();
}

refreshDashboard();

setInterval(refreshDashboard, 3000);