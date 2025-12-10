# 📱 تحويل هاتفك إلى كاميرا IP للاختبار

## الخيار 1: تطبيق IP Webcam (Android)

1. **حمّل التطبيق** من Google Play:
   - ابحث عن "IP Webcam" by Pavel Khlebovich
   
2. **شغّل التطبيق** واضغط "Start server"

3. **احصل على الرابط** (مثال):
   ```
   http://192.168.1.X:8080/video
   ```

4. **استخدم الرابط في نظرة**:
   ```bash
   curl -X POST "http://localhost:8000/api/v1/live/cameras?camera_id=phone&name=الهاتف&rtsp_url=http://192.168.1.X:8080/video"
   ```

---

## الخيار 2: تطبيق DroidCam (Android/iOS)

1. **حمّل التطبيق**:
   - Android: DroidCam
   - iOS: DroidCam

2. **حمّل البرنامج على Mac**:
   ```bash
   brew install --cask droidcam-client
   ```

3. **اتصل بالهاتف** عبر WiFi أو USB

---

## الخيار 3: تطبيق EpocCam (iOS)

1. **حمّل التطبيق** من App Store

2. **حمّل Driver على Mac**:
   https://www.elgato.com/en/epoccam

3. **الكاميرا ستظهر كـ** webcam عادية (index 0)

---

## الخيار 4: استخدام OBS Virtual Camera

1. **حمّل OBS**:
   ```bash
   brew install --cask obs
   ```

2. **أضف مصدر فيديو** (صورة/فيديو/شاشة)

3. **فعّل Virtual Camera**

4. **استخدم** كـ webcam في نظرة

---

## 🎬 اختبار سريع مع فيديو YouTube

يمكنك تحميل فيديو من YouTube للاختبار:

```bash
# تثبيت yt-dlp
pip3 install yt-dlp

# تحميل فيديو اختبار
yt-dlp -o test_video.mp4 "رابط_الفيديو"
```

ثم استخدم:
```bash
curl -X POST "http://localhost:8000/api/v1/live/test/video?video_path=./test_video.mp4"
```

---

## 🖼️ اختبار سريع مع صور

استخدم صفحة اختبار الكشف:
http://localhost:3000/detection

أو عبر API:
```bash
curl -X POST http://localhost:8000/api/v1/detection/test \
  -F "file=@صورة.jpg"
```
