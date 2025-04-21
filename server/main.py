from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from typing import Dict, List

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React 개발 서버 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 연결된 클라이언트를 저장
connected_clients: Dict[str, WebSocket] = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    connected_clients[client_id] = websocket
    
    try:
        while True:
            # 클라이언트로부터 데이터 수신
            data = await websocket.receive_text()
            avatar_state = json.loads(data)
            
            # 다른 클라이언트들에게 브로드캐스트
            for client in connected_clients.values():
                if client != websocket:
                    await client.send_text(data)
                    
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # 연결 종료 시 클라이언트 제거
        del connected_clients[client_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 