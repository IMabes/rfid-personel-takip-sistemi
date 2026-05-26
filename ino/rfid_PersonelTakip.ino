#include <SPI.h>      //RFID MODÜLÜ ESP32-CAM İLE SPI HABERLEŞMESİNİ KULLANARAK KONUŞUYOR
#include <MFRC522.h>  //RFID MODÜLÜNÜ KULLANMAMIZI SAĞLAYAN NESNE
//SİSTEM BÜYÜDÜ ARTIK İHTİYACIMIZ YOK . -> #include <Preferences.h> //ESP32'NİN KALICI HAFIZASINI KULLANIYOR
#include <WiFi.h>
#include <HTTPClient.h>


const char* ssid = "FiberHGW_TPC108";
const char* password = "ypmPbWcMRe9T";
const char* serverUrl = "http://192.168.1.104:5000/api/check-card";
const char* apiKey = "secureroom123";


#define SS_PIN 15
#define RST_PIN 2
#define FLASH_LED 4
#define SERVO_PIN 16

MFRC522 rfid(SS_PIN, RST_PIN);  //RFID MODÜLÜNÜ KONTROL EDECEK NESNE
//SİSTEM BÜYÜDÜ ARTIK İHTİYACIMIZ YOK . -> Preferences preferences;  // ESP32'NİN HAFIZASINA VERİ YAZIP OKUMAMIZI SAĞLAYAN NESNE
// rfid = kart okuyucu
// preferences = kartı hatırlayan hafıza

//SİSTEM BÜYÜDÜ ARTIK İHTİYACIMIZ YOK . -> String authorizedUID = "";
//yetkili kartın UID numarasını tutuyor

// Servo ayarları
const int servoFreq = 50;        //Servo motorlar genelde 50 Hz PWM sinyaliyle çalışır.
const int servoResolution = 16;  //servoResolution = 16 ise sinyal hassasiyetini belirliyor.
bool servoAttached = false;
String lastUID = "";
unsigned long lastReadTime = 0;
const unsigned long cardCooldown = 5000;

String getUID() {
  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }

    uid += String(rfid.uid.uidByte[i], HEX);

    if (i < rfid.uid.size - 1) {
      uid += " ";
    }
  }

  uid.toUpperCase();
  return uid;
}
//RFID KARTIN KİMLİK NUMARASINI OKU VE DÜZGÜN YAZIYA DÖNDÜR


void blinkBoot() {
  // Sistem açıldı testi: 2 hızlı yanıp sönme
  for (int i = 0; i < 2; i++) {
    digitalWrite(FLASH_LED, HIGH);
    delay(150);
    digitalWrite(FLASH_LED, LOW);
    delay(150);
  }
}

void blinkAccepted() {
  // Yetkili kart: 2 kısa yanıp sönme
  for (int i = 0; i < 2; i++) {
    digitalWrite(FLASH_LED, HIGH);
    delay(200);
    digitalWrite(FLASH_LED, LOW);
    delay(200);
  }
}

void blinkRejected() {
  // Yetkisiz kart: 1 uzun yanma
  digitalWrite(FLASH_LED, HIGH);
  delay(1200);
  digitalWrite(FLASH_LED, LOW);
}

void blinkLearned() {
  // İlk kart kaydedildi: 3 hızlı yanıp sönme
  for (int i = 0; i < 3; i++) {
    digitalWrite(FLASH_LED, HIGH);
    delay(120);
    digitalWrite(FLASH_LED, LOW);
    delay(120);
  }
}

void connectWiFi() {
  Serial.print("Wi-Fi baglaniyor: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int tryCount = 0;

  while (WiFi.status() != WL_CONNECTED && tryCount < 30) {
    delay(500);
    Serial.print(".");
    tryCount++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi baglandi.");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi baglanamadi.");
  }
}

bool checkCardWithBackend(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi bagli degil. Tekrar baglaniliyor...");
    connectWiFi();

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Wi-Fi baglanamadi. Kart kontrol edilemedi.");
      return false;
    }
  }

  HTTPClient http;

  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);

  String jsonData = "{";
  jsonData += "\"uid\":\"" + uid + "\"";
  jsonData += "}";

  Serial.print("Backend'e gonderilen UID: ");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP cevap kodu: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode <= 0) {
    Serial.println("Backend'e baglanilamadi.");
    http.end();
    return false;
  }

  String response = http.getString();

  Serial.println("Backend cevabi:");
  Serial.println(response);

  http.end();

  if (
    response.indexOf("\"authorized\":true") >= 0 || response.indexOf("\"authorized\": true") >= 0) {
    Serial.println("Backend karari: YETKILI");
    return true;
  }

  Serial.println("Backend karari: YETKISIZ");
  return false;
}

// İLK KARTI YETKİLİ KART OLARAK KAYDEDER


void writeServo(int angle) {
  if (!servoAttached) {
    ledcAttach(SERVO_PIN, servoFreq, servoResolution);
    servoAttached = true;
    delay(100);
  }

  int minPulse = 500;
  int maxPulse = 2400;

  int pulseWidth = map(angle, 0, 180, minPulse, maxPulse);

  // Servo 50Hz çalışır.
  // 1 periyot = 20ms = 20000us
  int duty = (pulseWidth * 65535) / 20000;

  // Yeni ESP32 Arduino sürümünde ledcWrite pin ile kullanılıyor
  ledcWrite(SERVO_PIN, duty);
}
//SERVOYU İSTEĞİMİZ AÇIYA DÖNDÜRÜYOR


void openDoor() {
  writeServo(90);
  delay(3000);
  writeServo(0);
}
//KAPIYI AÇTIRMA FONKSİYONU DÖN-3 SN BEKLE-TEKRAR 0 DERECEYE DÖN





void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(FLASH_LED, OUTPUT);
  digitalWrite(FLASH_LED, LOW);

  // Açılış testi: kod çalışıyor mu görmek için
  // blinkBoot();

  // RFID SPI pinleri
  // SCK  = GPIO14
  // MISO = GPIO12
  // MOSI = GPIO13
  // SS   = GPIO15
  SPI.begin(14, 12, 13, 15);
  rfid.PCD_Init();

  // Servo PWM başlatma
  // ledcAttach(SERVO_PIN, servoFreq, servoResolution);
  // writeServo(0);

  Serial.println("SecureRoom AI baslatildi.");
  Serial.println("Kart yetkisi artik backend veritabanindan kontrol ediliyor.");

  WiFi.setSleep(false);
  // Wi-Fi en son bağlansın
  connectWiFi();
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  String currentUID = getUID();

  Serial.print("Okunan kart UID: ");
  Serial.println(currentUID);

  if (currentUID == lastUID && millis() - lastReadTime < cardCooldown) {
    Serial.println("Ayni kart kisa sure once okundu. Tekrar islem yapilmadi.");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    return;
  }

  lastUID = currentUID;
  lastReadTime = millis();

  bool isAuthorized = checkCardWithBackend(currentUID);

  if (isAuthorized) {
    Serial.println("Yetkili kart. Kapi aciliyor.");

    blinkAccepted();
    openDoor();
  } else {
    Serial.println("Yetkisiz kart. Kapi acilmadi.");

    blinkRejected();
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000);
}
