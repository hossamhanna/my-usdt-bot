import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'

app = Flask(__name__)
@app.route('/')
def home(): return "Server Alive", 200

def run():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- محاولة الاتصال بـ Firebase مع تقرير خطأ ذكي ---
firebase_ready = False
error_msg = ""
try:
    if not firebase_admin._apps:
        # تأكد أن الملف مرفوع في المجلد الرئيسي بجانب main.py
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        firebase_ready = True
        print("✅ Firebase Connected")
except Exception as e:
    error_msg = str(e)
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

@bot.message_handler(commands=['start'])
def start(message):
    if message.chat.id == ADMIN_ID:
        if firebase_ready:
            bot.send_message(message.chat.id, "✅ البوت يعمل والقاعدة متصلة! استعمل /admin")
        else:
            bot.send_message(message.chat.id, f"⚠️ البوت يعمل لكن قاعدة البيانات فشلت:\n`{error_msg}`", parse_mode="Markdown")
    else:
        bot.send_message(message.chat.id, "👋 أهلاً بك! البوت قيد التشغيل حالياً.")

if __name__ == "__main__":
    Thread(target=run).start()
    bot.polling(none_stop=True)
