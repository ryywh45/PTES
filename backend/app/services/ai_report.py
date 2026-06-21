import json
import logging

from google import genai
from google.genai import errors as genai_errors

from app.config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash"


def is_ai_available() -> bool:
    return bool(GEMINI_API_KEY.strip())


def _models_to_try() -> list[str]:
    return list(dict.fromkeys([GEMINI_MODEL, DEFAULT_FALLBACK_MODEL]))


def _friendly_error(exc: Exception) -> str:
    if isinstance(exc, genai_errors.ClientError):
        message = str(exc)
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            return (
                f"Gemini API 配額已用盡（模型 {GEMINI_MODEL}）。"
                "已嘗試備用模型；若仍失敗請稍後再試，或至 Google AI Studio 檢查配額。"
            )
        if "404" in message or "NOT_FOUND" in message:
            return f"Gemini 模型不存在：{GEMINI_MODEL}。請在 .env 設定 GEMINI_MODEL=gemini-2.5-flash"
        if "401" in message or "403" in message or "API key" in message:
            return "Gemini API Key 無效或未授權，請檢查 backend/.env 的 GEMINI_API_KEY"
    return "Gemini AI 產生失敗，已改用模板產生"


def _build_prompt(context: dict) -> str:
    direction = context["direction"]
    projects = []
    for p in context["matched"]:
        projects.append(
            {
                "name": p["name"],
                "start_date": p["start_date"],
                "end_date": p["end_date"],
                "tags": context["tag_names"](p["tag_ids"]),
                "description": p["description"] or "",
            }
        )

    payload = {
        "direction_label": direction["label"],
        "direction_tags": direction["tags"],
        "projects": projects,
    }

    return f"""你是一位技術履歷撰寫助手。請根據以下 JSON 資料，為「{direction["label"]}」方向撰寫一份繁體中文 Markdown 技術總結。

要求：
1. 輸出純 Markdown，不要包在 code fence 內
2. 章節結構固定為：
   - # 技術總結 — {direction["label"]}
   - ## 概述
   - ## 關鍵技術
   - ## 詳細專案描述（每個專案用 ### 標題）
   - ## 結語
3. 只能使用提供的專案資料，禁止捏造不存在的專案、技術或成果
4. 語氣專業，適合求職或技術分享
5. 若 projects 為空，仍產生完整結構，概述與結語說明目前無相關專案

專案資料（JSON）：
{json.dumps(payload, ensure_ascii=False, indent=2)}"""


def generate_markdown_report(context: dict) -> tuple[str | None, str | None, str | None]:
    """Returns (markdown, error_message, model_used)."""
    if not is_ai_available():
        return None, None, None

    prompt = _build_prompt(context)
    client = genai.Client(api_key=GEMINI_API_KEY)
    last_error: str | None = None

    for model in _models_to_try():
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
            )
            text = (response.text or "").strip()
            if text:
                return text, None, model
        except Exception as exc:
            last_error = _friendly_error(exc)
            logger.warning("Gemini report failed (model=%s): %s", model, exc)

    return None, last_error, None
