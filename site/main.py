import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # すべてのオリジンを許可（本番環境では適切に設定してください）
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイルとテンプレートの設定
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# 設定
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'your-google-client-id')
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8000')

# ルート定義
@app.get('/chat', response_class=HTMLResponse)
async def chat_index(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request, "client_id": GOOGLE_CLIENT_ID, "backend_url": BACKEND_URL})

@app.get('/view', response_class=HTMLResponse)
async def view_index(request: Request):
    return templates.TemplateResponse("view.html", {"request": request})

# FastAPIでは、uvicornを使ってサーバーを起動します。
# コマンドラインから `uvicorn main:app --reload --port 8010` を実行してください。
