import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import time

# ================= إعدادات البوت =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'

# الآيدي الخاص بك كمدير
ADMIN_ID = 1683002116 

# رابط لوجو البوت (استبدله برابط صورتك)
BOT_LOGO_URL = "https://example.com/your-logo.jpg" 

# قائمة القنوات للاشتراك الإجباري
CHANNELS = [
    {"name": "Join Channel 1", "url": "https://t.me/YourChannel1"},
    {"name": "Join Channel 2", "url": "https://t.me/YourChannel2"},
]
# ===============================================

app = Flask('')
@app.route('/')
def home(): return "Bot is Alive!"
def run(): app.run(host='0.0.0.0', port=8080)
def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    users_ref = db.reference('users')
except Exception as e:
    print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- لوحات المفاتيح ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Users Count", "💰 Give Balance")
    markup.add("📢 Broadcast", "🏠 Back to User Menu")
    return markup

# --- أوامر الإدارة ---
@bot.message_handler(commands=['admin'])
def admin_command(message):
    if message.from_user.id == ADMIN_ID:
        bot.send_message(message.chat.id, "🛠️ Welcome Back Boss! Admin Panel is ready.", reply_markup=admin_menu())
    else:
        bot.send_message(message.chat.id, "❌ Not authorized.")

@bot.message_handler(func=lambda m: m.text == "📊 Users Count")
def users_count(message):
    if message.from_user.id == ADMIN_ID:
        users = users_ref.get()
        count = len(users) if users else 0
        bot.send_message(message.chat.id, f"👥 Total Registered Users: {count}")

@bot.message_handler(func=lambda m: m.text == "💰 Give Balance")
def give_balance_step1(message):
    if message.from_user.id == ADMIN_ID:
        msg = bot.send_message(message.chat.id, "Enter `UserID:Amount` (Example: `1683002116:50`)", parse_mode="Markdown")
        bot.register_next_step_handler(msg, give_balance_step2)

def give_balance_step2(message):
    try:
        uid, amount = message.text.split(':')
        current_data = users_ref.child(uid).get()
        if current_data:
            new_balance = float(current_data.get('balance', 0)) + float(amount)
            users_ref.child(uid).update({'balance': round(new_balance, 4)})
            bot.send_message(message.chat.id, f"✅ Successfully added {amount} USDT to {uid}.")
        else:
            bot.send_message(message.chat.id, "❌ User not found.")
    except:
        bot.send_message(message.chat.id, "❌ Error. Use format ID:Amount")

@bot.message_handler(func=lambda m: m.text == "📢 Broadcast")
def broadcast_step1(message):
    if message.from_user.id == ADMIN_ID:
        msg = bot.send_message(message.chat.id, "Send the message you want to broadcast to ALL users:")
        bot.register_next_step_handler(msg, broadcast_step2)

def broadcast_step2(message):
    users = users_ref.get()
    if not users: return
    count = 0
    for uid in users:
        try:
            bot.send_message(uid, f"📢 **MESSAGE FROM ADMIN**\n\n{message.text}", parse_mode="Markdown")
            count += 1
            time.sleep(0.1) # لتجنب حظر التليجرام
        except: pass
    bot.send_message(message.chat.id, f"✅ Done! Message sent to {count} users.")

@bot.message_handler(func=lambda m: m.text == "🏠 Back to User Menu")
def back_to_main(message):
    bot.send_message(message.chat.id, "Switching to User View...", reply_markup=main_menu())

# --- أوامر البوت الأساسية ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    if not users_ref.child(user_id).get():
        users_ref.child(user_id).set({'balance': 0.0, 'referrals': 0, 'verified': False})

    markup = types.InlineKeyboardMarkup(row_width=1)
    for ch in CHANNELS:
        markup.add(types.InlineKeyboardButton(ch['name'], url=ch['url']))
    markup.add(types.InlineKeyboardButton("✅ Done", callback_data="check_subs"))
    
    welcome_text = "👋 Welcome!\n🏆 Join channels below then click Done."
    
    if BOT_LOGO_URL != "https://example.com/your-logo.jpg":
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=welcome_text, reply_markup=markup)
    else:
        bot.send_message(message.chat.id, welcome_text, reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "check_subs")
def check_subs(call):
    markup = types.InlineKeyboardMarkup()
    btn_verify = types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL))
    markup.add(btn_verify)
    bot.send_message(call.message.chat.id, "✅ Channels joined! Now verify your device.", reply_markup=markup)
    bot.send_message(call.message.chat.id, "Explore our features:", reply_markup=main_menu())

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    user_id = str(message.chat.id)
    data = users_ref.child(user_id).get() or {'balance': 0.0, 'referrals': 0}
    text = f"👤 *Your Profile*\n\n💰 Balance: {data['balance']} USDT\n👥 Referrals: {data['referrals']}"
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

if __name__ == "__main__":
    keep_alive()
    print("🚀 Bot is running with Admin ID: 1683002116")
    bot.polling(none_stop=True)
