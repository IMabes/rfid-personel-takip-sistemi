from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from pathlib import Path
import sqlite3
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from uuid import uuid4

from face_service import compare_faces


# =========================
# PATH / FLASK AYARLARI
# =========================
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"
TEMPLATE_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"
FRONTEND_STATIC_DIR = str(STATIC_DIR)

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/static"
)

CORS(app)


# =========================
# PROJE AYARLARI
# =========================
DB_PATH = BACKEND_DIR / "secureroom.db"
DB_NAME = "secureroom.db"
API_KEY = "secureroom123"

@app.route("/")
def index():
    # index.html proje ana dizininde duruyor
    return send_from_directory(str(PROJECT_DIR), "index.html")


@app.route("/admin")
def admin():
    # adminpanel.html frontend/templates içinde duruyor
    return render_template("adminpanel.html")


# =========================
# UPLOAD AYARLARI
# =========================
UPLOAD_FOLDER = STATIC_DIR / "uploads" / "users"
ACCESS_LOG_UPLOAD_FOLDER = STATIC_DIR / "uploads" / "access_logs"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
ACCESS_LOG_UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def normalize_uid(uid):
    if not uid:
        return ""

    return (
        uid.upper()
        .replace(":", " ")
        .replace("-", " ")
        .strip()
    )

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def add_column_if_not_exists(conn, table_name, column_name, column_definition):
    try:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")
    except sqlite3.OperationalError:
        # Kolon zaten varsa SQLite hata verir; bunu normal kabul ediyoruz.
        pass


def create_database():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT,
            created_at TEXT NOT NULL
        )
    """)

    add_column_if_not_exists(conn, "events", "photo_path", "TEXT")
    add_column_if_not_exists(conn, "events", "face_verified", "INTEGER DEFAULT 0")
    add_column_if_not_exists(conn, "events", "face_distance", "REAL")
    add_column_if_not_exists(conn, "events", "face_message", "TEXT")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            uid TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)

    add_column_if_not_exists(conn, "users", "photo_path", "TEXT")

    conn.commit()
    conn.close()


@app.route("/api/event", methods=["POST"])
def create_event():
    api_key = request.headers.get("X-API-Key")

    if api_key != API_KEY:
        return jsonify({
            "success": False,
            "message": "Geçersiz API anahtarı"
        }), 401

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "JSON veri gönderilmedi"
        }), 400

    uid = data.get("uid")
    status = data.get("status")
    message = data.get("message", "")

    if not uid or not status:
        return jsonify({
            "success": False,
            "message": "uid ve status zorunludur"
        }), 400

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO events (uid, status, message, created_at)
        VALUES (?, ?, ?, ?)
    """, (uid, status, message, created_at))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Olay kaydedildi"
    }), 201


@app.route("/api/events", methods=["GET"])
def get_events():
    conn = get_db_connection()
    events = conn.execute("""
        SELECT * FROM events
        ORDER BY id DESC
        LIMIT 50
    """).fetchall()
    conn.close()

    event_list = []

    for event in events:
        event_list.append({
            "id": event["id"],
            "uid": event["uid"],
            "status": event["status"],
            "message": event["message"],
            "created_at": event["created_at"],
            "photo_path": event["photo_path"] if "photo_path" in event.keys() else None
        })

    return jsonify(event_list)


@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db_connection()

    total = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    authorized = conn.execute("""
        SELECT COUNT(*) FROM events WHERE status = 'authorized'
    """).fetchone()[0]
    unauthorized = conn.execute("""
        SELECT COUNT(*) FROM events WHERE status = 'unauthorized'
    """).fetchone()[0]

    conn.close()

    return jsonify({
        "total": total,
        "authorized": authorized,
        "unauthorized": unauthorized
    })
    
@app.route("/api/users", methods=["GET"])
def get_users():
    conn = get_db_connection()

    users = conn.execute("""
        SELECT * FROM users
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    user_list = []

    for user in users:
        user_list.append({
            "id": user["id"],
            "name": user["name"],
            "uid": user["uid"],
            "role": user["role"],
            "is_active": user["is_active"],
            "created_at": user["created_at"],
            "photo_path": user["photo_path"] if "photo_path" in user.keys() else None
        })

    return jsonify(user_list)


@app.route("/api/users", methods=["POST"])
def add_user():
    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "JSON veri gönderilmedi"
        }), 400

    name = data.get("name")
    uid = data.get("uid")
    role = data.get("role", "user")

    if not name or not uid:
        return jsonify({
            "success": False,
            "message": "name ve uid zorunludur"
        }), 400

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        conn = get_db_connection()

        conn.execute("""
            INSERT INTO users (name, uid, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (name, uid, role, 1, created_at))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Kullanıcı/kart başarıyla eklendi"
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "Bu UID zaten kayıtlı"
        }), 409
 
 
@app.route("/api/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "JSON veri gönderilmedi"
        }), 400

    name = data.get("name")
    uid = data.get("uid")
    role = data.get("role", "user")
    is_active = data.get("is_active", 1)

    if not name or not uid:
        return jsonify({
            "success": False,
            "message": "name ve uid zorunludur"
        }), 400

    uid = normalize_uid(uid)

    try:
        conn = get_db_connection()
        
        

        user = conn.execute("""
            SELECT * FROM users WHERE id = ?
        """, (user_id,)).fetchone()

        if not user:
            conn.close()
            return jsonify({
                "success": False,
                "message": "Kullanıcı bulunamadı"
            }), 404

        conn.execute("""
            UPDATE users
            SET name = ?, uid = ?, role = ?, is_active = ?
            WHERE id = ?
        """, (name, uid, role, is_active, user_id))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Kullanıcı/kart güncellendi"
        })

    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "Bu UID başka bir kullanıcıda kayıtlı"
        }), 409
        
               
        
@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    conn = get_db_connection()

    user = conn.execute("""
        SELECT * FROM users WHERE id = ?
    """, (user_id,)).fetchone()

    if not user:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Kullanıcı bulunamadı"
        }), 404

    conn.execute("""
        DELETE FROM users WHERE id = ?
    """, (user_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Kullanıcı/kart silindi"
    })
    


@app.route("/api/users/<int:user_id>/toggle", methods=["PUT"])
def toggle_user_status(user_id):
    conn = get_db_connection()

    user = conn.execute("""
        SELECT * FROM users WHERE id = ?
    """, (user_id,)).fetchone()

    if not user:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Kullanıcı bulunamadı"
        }), 404

    new_status = 0 if user["is_active"] == 1 else 1

    conn.execute("""
        UPDATE users
        SET is_active = ?
        WHERE id = ?
    """, (new_status, user_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Kullanıcı durumu güncellendi",
        "is_active": new_status
    })
    
    
    
@app.route("/api/users/<int:user_id>/photo", methods=["POST"])
def upload_user_photo(user_id):
    if "photo" not in request.files:
        return jsonify({
            "success": False,
            "message": "Fotoğraf dosyası gönderilmedi"
        }), 400

    file = request.files["photo"]

    if file.filename == "":
        return jsonify({
            "success": False,
            "message": "Dosya seçilmedi"
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "message": "Sadece png, jpg veya jpeg dosyaları yüklenebilir"
        }), 400

    conn = get_db_connection()
    
    def normalize_uid(uid):
        return uid.upper().replace(":", " ").replace("-", " ").strip()

    user = conn.execute("""
        SELECT * FROM users WHERE id = ?
    """, (user_id,)).fetchone()

    if not user:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Kullanıcı bulunamadı"
        }), 404

    filename = secure_filename(f"user_{user_id}_{file.filename}")
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)

    photo_path = f"/static/uploads/users/{filename}"

    conn.execute("""
        UPDATE users
        SET photo_path = ?
        WHERE id = ?
    """, (photo_path, user_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Kullanıcı fotoğrafı yüklendi",
        "photo_path": photo_path
    })
    

@app.route("/api/check-card", methods=["POST"])
def check_card():
    api_key = request.headers.get("X-API-Key")

    if api_key != API_KEY:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "Geçersiz API anahtarı"
        }), 401

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "JSON veri gönderilmedi"
        }), 400

    uid = data.get("uid")

    if not uid:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "uid zorunludur"
        }), 400

    # UID formatını standartlaştırıyoruz
    uid = normalize_uid(uid)

    conn = get_db_connection()

    user = conn.execute("""
        SELECT * FROM users
        WHERE uid = ?
    """, (uid,)).fetchone()

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if user and user["is_active"] == 1:
        status = "authorized"
        message = f"{user['name']} giriş yaptı"

        conn.execute("""
            INSERT INTO events (uid, status, message, created_at)
            VALUES (?, ?, ?, ?)
        """, (uid, status, message, created_at))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "authorized": True,
            "name": user["name"],
            "role": user["role"],
            "message": message
        }), 200

    elif user and user["is_active"] == 0:
        status = "unauthorized"
        message = "Kart pasif durumda"

        conn.execute("""
            INSERT INTO events (uid, status, message, created_at)
            VALUES (?, ?, ?, ?)
        """, (uid, status, message, created_at))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "authorized": False,
            "message": message
        }), 200

    else:
        status = "unauthorized"
        message = "Kayıtsız kart denemesi"

        conn.execute("""
            INSERT INTO events (uid, status, message, created_at)
            VALUES (?, ?, ?, ?)
        """, (uid, status, message, created_at))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "authorized": False,
            "message": message
        }), 200


@app.route("/api/test", methods=["POST"])
def test_event():
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO events (uid, status, message, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        "TEST CARD",
        "authorized",
        "Manuel test kaydı",
        created_at
    ))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Test kaydı oluşturuldu"
    })
    
    
@app.route("/api/check-card-photo", methods=["POST"])
def check_card_photo():
    api_key = request.headers.get("X-API-Key")

    if api_key != API_KEY:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "Geçersiz API anahtarı"
        }), 401

    uid = request.headers.get("X-Card-UID")

    if not uid:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "Kart UID gönderilmedi"
        }), 400

    photo_bytes = request.get_data()

    if not photo_bytes:
        return jsonify({
            "success": False,
            "authorized": False,
            "message": "Fotoğraf verisi gönderilmedi"
        }), 400

    uid = normalize_uid(uid)
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    filename = f"access_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}.jpg"
    save_path = os.path.join(ACCESS_LOG_UPLOAD_FOLDER, filename)

    with open(save_path, "wb") as f:
        f.write(photo_bytes)

    photo_path = f"/static/uploads/access_logs/{filename}"

    conn = get_db_connection()

    user = conn.execute("""
        SELECT * FROM users
        WHERE uid = ?
    """, (uid,)).fetchone()

    face_verified = 0
    face_distance = None
    face_message = None

    if not user:
        status = "unauthorized"
        message = "Kayıtsız kart denemesi"
        authorized = False
        face_message = "Kart kayıtlı olmadığı için yüz kontrolü yapılmadı"

    elif user["is_active"] != 1:
        status = "unauthorized"
        message = f"Pasif kart denemesi: {user['name']}"
        authorized = False
        face_message = "Kart pasif olduğu için yüz kontrolü yapılmadı"

    else:
        user_photo_path = user["photo_path"] if "photo_path" in user.keys() else None

        if not user_photo_path:
            status = "unauthorized"
            message = f"Kullanıcının kayıtlı yüz fotoğrafı yok: {user['name']}"
            authorized = False
            face_message = "Kayıtlı kullanıcı fotoğrafı yok"

        else:
            face_result = compare_faces(
                user_photo_path,
                photo_path,
                FRONTEND_STATIC_DIR
            )

            face_verified = 1 if face_result["verified"] else 0
            face_distance = face_result.get("distance")
            face_message = face_result.get("message")

            if face_result["verified"]:
                status = "authorized"
                message = f"{user['name']} yüz doğrulamasıyla giriş yaptı"
                authorized = True
            else:
                status = "unauthorized"
                message = f"Kart doğru ama yüz uyuşmadı: {user['name']} adına şüpheli giriş"
                authorized = False

    conn.execute("""
        INSERT INTO events (
            uid, status, message, created_at, photo_path,
            face_verified, face_distance, face_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        uid, status, message, created_at, photo_path,
        face_verified, face_distance, face_message
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "authorized": authorized,
        "uid": uid,
        "status": status,
        "message": message,
        "photo_path": photo_path,
        "face_verified": face_verified,
        "face_distance": face_distance,
        "face_message": face_message
    }), 200
    
    



if __name__ == "__main__":
    create_database()
    app.run(host="0.0.0.0", port=5000, debug=True)