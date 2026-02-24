"""
⑤ Streamlit チャットUI(ChatGPT版) — PoC実装

必要なライブラリ:
  pip install streamlit mcp openai

使い方:
  streamlit run gsc_chatgpt.py
"""

import asyncio
import json
import os
import threading

from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import OpenAI
import streamlit as st

# =====================
# 設定
# =====================
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = "gpt-4.1"

SYSTEM_PROMPT = """
あなたはGoogle Search Console(GSC)のデータアナリストです。
ユーザーの質問に答えるために、利用可能なGSCツールを積極的に呼び出してください。

利用可能なツール:
- list_sites: 管理サイト一覧を取得
- get_search_analytics: キーワード・ページ・日別・デバイス・国別のパフォーマンスデータを取得
- inspect_url: 特定URLのインデックス状況を確認

データを取得したら、数字を引用しながら日本語で分かりやすく回答してください。
"""

# =====================
# MCPセッション管理（スレッドをまたいで保持）
# =====================
_mcp_session: ClientSession | None = None
_mcp_tools: list[dict] = []
_loop: asyncio.AbstractEventLoop | None = None
_ready_event = threading.Event()


def mcp_tools_to_openai(mcp_tools) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.inputSchema,
            },
        }
        for t in mcp_tools
    ]


async def _mcp_worker():
    global _mcp_session, _mcp_tools

    server_params = StdioServerParameters(
        command="python",
        args=["gsc_mcp_server.py"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools_resp = await session.list_tools()

            _mcp_session = session
            _mcp_tools = mcp_tools_to_openai(tools_resp.tools)
            _ready_event.set()

            await asyncio.get_event_loop().create_future()


def _start_background_loop():
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_until_complete(_mcp_worker())


def get_mcp_session() -> tuple[ClientSession, list[dict]]:
    if "mcp_started" not in st.session_state:
        st.session_state["mcp_started"] = True
        t = threading.Thread(target=_start_background_loop, daemon=True)
        t.start()
        _ready_event.wait(timeout=10)
    return _mcp_session, _mcp_tools


# =====================
# エージェント呼び出し（同期ラッパー）
# =====================
async def _run_agent(
    session: ClientSession, tools: list[dict], messages: list[dict]
) -> tuple[str, list[dict]]:
    client = OpenAI(api_key=OPENAI_API_KEY)
    tool_calls_log = []

    request_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]

    while True:
        response = client.chat.completions.create(
            model=MODEL,
            messages=request_messages,
            tools=tools,
            tool_choice="auto",
        )
        msg = response.choices[0].message

        tool_calls = []
        for tc in (msg.tool_calls or []):
            tool_calls.append(
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
            )

        request_messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": tool_calls,
            }
        )

        if not msg.tool_calls:
            return msg.content or "", tool_calls_log

        for tc in msg.tool_calls:
            tool_name = tc.function.name
            try:
                tool_input = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                tool_input = {}

            result = await session.call_tool(tool_name, tool_input)
            result_text = result.content[0].text if result.content else "結果なし"

            tool_calls_log.append(
                {"name": tool_name, "input": tool_input, "result": result_text}
            )

            request_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_text,
                }
            )


def run_agent_sync(user_message: str, history: list[dict]) -> tuple[str, list[dict]]:
    session, tools = get_mcp_session()
    messages = history + [{"role": "user", "content": user_message}]

    future = asyncio.run_coroutine_threadsafe(
        _run_agent(session, tools, messages),
        _loop,
    )
    return future.result(timeout=60)


# =====================
# Streamlit UI
# =====================
st.set_page_config(
    page_title="GSC アナリスト (ChatGPT)",
    page_icon="🔍",
    layout="centered",
)

st.title("🔍 GSC アナリスト (ChatGPT)")
st.caption("Google Search Console のデータを自然言語で質問できます")

if not OPENAI_API_KEY:
    st.error("OPENAI_API_KEY が設定されていません。")
    st.stop()

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("tool_calls"):
            with st.expander("🛠 ツール呼び出し詳細"):
                for tc in msg["tool_calls"]:
                    st.markdown(f"**`{tc['name']}`** `{tc['input']}`")
                    st.code(tc["result"], language="text")

if prompt := st.chat_input("例: 先月のトップキーワードを教えて"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("GSCを調査中..."):
            api_history = [
                {"role": m["role"], "content": m["content"]}
                for m in st.session_state.messages[:-1]
            ]
            answer, tool_calls = run_agent_sync(prompt, api_history)

        st.markdown(answer)

        if tool_calls:
            with st.expander("🛠 ツール呼び出し詳細"):
                for tc in tool_calls:
                    st.markdown(f"**`{tc['name']}`** `{tc['input']}`")
                    st.code(tc["result"], language="text")

    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": answer,
            "tool_calls": tool_calls,
        }
    )
