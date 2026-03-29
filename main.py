import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# --- ⚙️ الإعدادات الأساسية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- 🌐 نظام Flask لضمان استقرار Render ---
app = Flask('')
@app.route('/')
def home(): return "Bot is Online", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- 🔥 الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    firebase_connected = True
except Exception as e:
    firebase_connected = False
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- 🛡️ نظام الحماية القوي (Anti-Clone) ---
def is_safe(message):
    # منع الحسابات التي لا تملك اسم مستخدم (حماية من البوتات الوهمية)
    if not message.from_user.username:
        return False, "⚠️ حماية: يجب تعيين 'Username' لحسابك لاستخدام البوت."
    return True, "Safe"

# --- 📢 فحص الاشتراك الإجباري ---
def check_sub(user_id):
    if user_id == ADMIN_ID: return True
    for ch in REQUIRED_CHANNELS:
        try:
            status = bot.get_chat_member(ch, user_id).status
            if status in ['left', 'kicked']: return False
        except: continue
    return True

# --- ⌨️ القوائم ---
def main_kb():
    m = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    m.add("👤 حسابي", "🔗 رابط الإحالة", "🎡 عجلة الحظ", "🎯 المهام", "📊 إحصائيات", "🎧 الدعم")
    return m

def admin_kb():
    m = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    m.add("📊 إحصائيات البوت", "➕ إضافة رصيد", "📢 إرسال إعلان", "🏠 وضع المستخدم")
    return m

# --- 🤖 الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # 1. فحص الحماية
    safe, msg = is_safe(message)
    if not safe:
        bot.send_message(user_id, msg)
        return

    # 2. تسجيل المستخدم
    if firebase_connected:
        ref = db.reference(f'users/{user_id}')
        if not ref.get():
            ref.set({'balance': 0.0, 'referrals': 0, 'username': message.from_user.username})

    # 3. فحص الاشتراك
    if not check_sub(message.chat.id):
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"📢 اشترك في {ch}", url=f"https://t.me/{ch.replace('@','')}"))
        markup.add(types.InlineKeyboardButton("✅ تم الاشتراك", callback_data="verify"))
        
        bot.send_photo(user_id, LOGO_URL, caption="👋 **أهلاً بك!**\n\nيجب عليك الاشتراك في القنوات أدناه لتفعيل البوت والاستفادة من المميزات.", reply_markup=markup, parse_mode="Markdown")
        return

    # 4. توجيه الإدارة أو المستخدم
    if message.chat.id == ADMIN_ID:
        bot.send_photo(user_id, LOGO_URL, caption="💻 **لوحة تحكم المدير**\n\nالنظام يعمل بكفاءة وحماية الـ Anti-Clone مفعلة.", reply_markup=admin_kb(), parse_mode="Markdown")
    else:
        bot.send_photo(user_id, LOGO_URL, caption="مرحباً بك في Earn Master Bot! 👋\nابدأ الآن بجمع الأرباح.", reply_markup=main_kb())

@bot.callback_query_handler(func=lambda call: call.data == "verify")
def verify_btn(call):
    if check_sub(call.from_user.id):
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_message(call.message.chat.id, "✅ تم التحقق بنجاح! تم فتح البوت.", reply_markup=main_kb())
    else:
        bot.answer_callback_query(call.id, "❌ لم تشترك في القنوات بعد!", show_alert=True)

@bot.message_handler(func=lambda m: True)
def handle_msg(message):
    if not check_sub(message.chat.id): return
    
    if message.text == "👤 حسابي":
        u = db.reference(f'users/{message.chat.id}').get() or {'balance': 0}
        bot.send_message(message.chat.id, f"💰 **رصيدك الحالي:** {u.get('balance')} USDT")
    
    elif message.text == "📊 إحصائيات البوت" and message.chat.id == ADMIN_ID:
        total = len(db.reference('users').get() or {})
        bot.send_message(ADMIN_ID, f"📈 إجمالي المستخدمين: {total}")

# --- 🔄 التشغيل ---
if __name__ == "__main__":
    Thread(target=run_flask).start()
    print("🚀 البوت انطلق مع اللوجو ونظام الحماية...")
    while True:
        try:
            bot.polling(none_stop=True, timeout=60)
        except Exception as e:
            time.sleep(5)
