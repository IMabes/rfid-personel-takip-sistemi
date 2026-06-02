import os
from deepface import DeepFace


FACE_MODEL_NAME = "ArcFace"
FACE_DETECTOR_BACKEND = "retinaface"
FACE_DISTANCE_METRIC = "cosine"

# Modelin kendi eşik değerine küçük tolerans ekliyoruz.
# 0.03 güvenli-toleranslı arası iyi başlangıç.
# Çok yükseltirsek başkasını kabul etme riski artar.
FACE_TOLERANCE = 0.03


def static_url_to_file_path(static_path, frontend_static_dir):
    if not static_path:
        return None

    clean_path = static_path.replace("\\", "/").lstrip("/")

    if clean_path.startswith("static/"):
        relative_path = clean_path.replace("static/", "", 1)
        return os.path.join(frontend_static_dir, relative_path)

    return static_path


def compare_faces(registered_photo_url, captured_photo_url, frontend_static_dir):
    registered_photo_path = static_url_to_file_path(
        registered_photo_url,
        frontend_static_dir
    )

    captured_photo_path = static_url_to_file_path(
        captured_photo_url,
        frontend_static_dir
    )

    if not registered_photo_path or not os.path.exists(registered_photo_path):
        return {
            "verified": False,
            "distance": None,
            "threshold": None,
            "message": "Kullanıcının kayıtlı fotoğraf dosyası bulunamadı"
        }

    if not captured_photo_path or not os.path.exists(captured_photo_path):
        return {
            "verified": False,
            "distance": None,
            "threshold": None,
            "message": "Giriş anı fotoğrafı bulunamadı"
        }

    try:
        result = DeepFace.verify(
            img1_path=registered_photo_path,
            img2_path=captured_photo_path,
            model_name=FACE_MODEL_NAME,
            detector_backend=FACE_DETECTOR_BACKEND,
            distance_metric=FACE_DISTANCE_METRIC,
            enforce_detection=True,
            align=True
        )

        distance = result.get("distance")
        threshold = result.get("threshold")

        if distance is not None and threshold is not None:
            custom_threshold = threshold + FACE_TOLERANCE
            verified = distance <= custom_threshold
        else:
            custom_threshold = threshold
            verified = bool(result.get("verified"))

        print("FACE VERIFY RESULT")
        print("Model:", FACE_MODEL_NAME)
        print("Detector:", FACE_DETECTOR_BACKEND)
        print("Distance:", distance)
        print("Original threshold:", threshold)
        print("Custom threshold:", custom_threshold)
        print("Verified:", verified)

        return {
            "verified": verified,
            "distance": distance,
            "threshold": custom_threshold,
            "message": "Yüz doğrulandı" if verified else "Yüz uyuşmadı"
        }

    except Exception as error:
        return {
            "verified": False,
            "distance": None,
            "threshold": None,
            "message": f"Yüz doğrulama hatası: {str(error)}"
        }