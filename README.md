<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00F5FF,100:7A00FF&height=220&section=header&text=SecureRoom%20IoT&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=RFID%20Tabanlı%20Akıllı%20Giriş%20ve%20Personel%20Takip%20Sistemi&descSize=18&descAlignY=58" />

</div>

<div align="center">

![Python](https://img.shields.io/badge/Python-111827?style=for-the-badge&logo=python&logoColor=00F5FF)
![Flask](https://img.shields.io/badge/Flask-111827?style=for-the-badge&logo=flask&logoColor=7A00FF)
![Arduino](https://img.shields.io/badge/Arduino-111827?style=for-the-badge&logo=arduino&logoColor=00F5FF)
![IoT](https://img.shields.io/badge/IoT-111827?style=for-the-badge&logo=internetofthings&logoColor=white)
![RFID](https://img.shields.io/badge/RFID-Access%20Control-111827?style=for-the-badge&logoColor=00F5FF)

</div>

---

## 🚀 Proje Hakkında

**SecureRoom IoT**, RFID kart okuma teknolojisi ve IoT tabanlı cihaz haberleşmesini kullanarak geliştirilen akıllı bir giriş kontrol ve personel takip sistemidir.

Sistem; RFID kart doğrulama, yetkili/yetkisiz giriş kontrolü, giriş loglarının tutulması ve web tabanlı admin paneli üzerinden kart yönetimi gibi özellikler sunar.

---

## ⚡ Özellikler

- 🪪 RFID kart okuma
- 🔐 Yetkili / yetkisiz giriş kontrolü
- 🌐 Flask tabanlı backend API
- 📊 Admin panel üzerinden giriş logları
- 🧑‍💻 Kullanıcı ve kart yönetimi
- 📡 ESP32 ile IoT haberleşmesi
- 🗃️ Veritabanı destekli kayıt sistemi
- 🚨 Geliştirilebilir güvenlik mimarisi

---

## 🛠️ Kullanılan Teknolojiler

<div align="center">

| Donanım | Yazılım |
|---|---|
| ESP32 / ESP32-CAM | Python |
| MFRC522 RFID Reader | Flask |
| RFID Kart / Anahtarlık | HTML |
| Breadboard | CSS |
| Jumper Kablolar | JavaScript |
| LED / Flash LED | SQLite |

</div>

---

## 🧠 Sistem Çalışma Mantığı

```mermaid
flowchart TD
    A[RFID Kart Okutulur] --> B[ESP32 UID Bilgisini Okur]
    B --> C[Backend API'ye Gönderir]
    C --> D{Kart Yetkili mi?}
    D -- Evet --> E[Giriş Başarılı]
    D -- Hayır --> F[Yetkisiz Giriş]
    E --> G[Log Kaydı Oluşturulur]
    F --> G
    G --> H[Admin Panelde Görüntülenir]
