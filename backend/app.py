from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "frontend", "static"),
    static_url_path="/static"
)




CORS(app)

DB_NAME = "secureroom.db"
API_KEY = "secureroom123"


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


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
    
    conn.commit()
    conn.close()


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/admin")
def admin_panel():
    return send_from_directory(os.path.join(BASE_DIR, "frontend/templates"), "adminpanel.html")


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
            "created_at": event["created_at"]
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
            "created_at": user["created_at"]
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

    uid = uid.upper().replace(":", " ").strip()

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
    uid = uid.upper().replace(":", " ").strip()

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


if __name__ == "__main__":
    create_database()
    app.run(host="0.0.0.0", port=5000, debug=True)