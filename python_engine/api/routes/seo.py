import re

from fastapi import APIRouter, HTTPException
from python_engine.core import database
from python_engine.schemas.seo_schemas import (
    ImproveSchemaRequest,
    KeywordDensityResult,
    KeywordExtractionRequest,
    SeoAnalysisRequest,
)
from python_engine.services import schema_service, seo_scraper

router = APIRouter()


@router.get("/history")
async def get_history_endpoint():
    """Lấy danh sách kết quả đã lưu trong database."""
    try:
        results = await database.get_all_seo_results()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/history")
async def clear_history_endpoint():
    """Xóa toàn bộ lịch sử quét."""
    try:
        await database.clear_seo_history()
        return {"status": "success", "message": "History cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/save")
async def save_result_endpoint(request: dict):
    """
    Lưu kết quả từ bất kỳ nguồn nào (Next.js hoặc Python) vào DB.
    Dữ liệu cần tương thích với bảng seo_results.
    """
    try:
        await database.save_seo_result(request)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/extract-keywords")
async def extract_keywords_endpoint(request: KeywordExtractionRequest):
    """
    Endpoint riêng biệt chỉ để trích xuất từ khóa.
    Ưu tiên dùng Jina Reader (URL) -> Phụ trợ bằng HTML thô.
    """
    try:
        top_kws = []
        phrase_keywords = []
        # Ưu tiên 1: Jina Reader (Dùng URL)
        if request.url:
            top_kws = await seo_scraper.extract_keywords_jina(request.url)

        # Ưu tiên 2: Fallback HTML thô (Nếu Jina thất bại hoặc không có URL)
        if not top_kws and request.html:
            top_kws = seo_scraper.extract_keywords_weighted(request.html)

        # Calculate counts
        kw_in_title = 0
        kw_in_meta = 0

        final_kws = []
        if top_kws:
            # Simple text cleaning for count (Prefer HTML if available for density count)
            content_for_counting = request.html
            if not content_for_counting and request.url:
                # Nếu không có HTML, ta vẫn lấy text thô từ nội dung Jina/BeautifulSoup.
                # Jina tốt hơn cho việc trích xuất keywords tinh khiết.
                # Tuy nhiên để tính mật độ chính xác, ta ưu tiên HTML gốc.
                pass

            if content_for_counting:
                soup = seo_scraper.BeautifulSoup(content_for_counting, "lxml")
                clean_text = soup.get_text()
            else:
                clean_text = ""  # Fallback

            phrase_keywords = seo_scraper.extract_phrase_keywords_yake_pos(clean_text, top_n=10)

            full_text_lower = clean_text.lower()
            word_count = len(re.findall(r"\w+", full_text_lower)) if full_text_lower else 1

            title_lower = request.title.lower() if request.title else ""
            desc_lower = request.description.lower() if request.description else ""

            # Prefer YAKE + POS phrase table.
            if phrase_keywords:
                final_kws = phrase_keywords
            else:
                # Legacy fallback when phrase extraction yields nothing.
                for kw in top_kws:
                    kw_lower = kw.lower()
                    kw_matches = re.findall(re.escape(kw_lower), full_text_lower)
                    count = len(kw_matches) if full_text_lower else 0
                    density = (count / word_count * 100) if word_count > 0 else 0
                    final_kws.append(
                        KeywordDensityResult(word=kw, count=count, density=f"{density:.2f}%")
                    )

            # Compute title/meta coverage using final keywords actually returned.
            for kw_item in final_kws:
                kw_lower = kw_item.word.lower()
                if title_lower and kw_lower in title_lower:
                    kw_in_title += 1
                if desc_lower and kw_lower in desc_lower:
                    kw_in_meta += 1

        return {
            "top_keywords": final_kws,
            "keywords_in_title": kw_in_title,
            "keywords_in_meta": kw_in_meta,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/analyze")
async def analyze_seo_endpoint(request: SeoAnalysisRequest):
    # ... (existing code)
    try:
        result = await seo_scraper.analyze_url(str(request.url), request.keyword)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:
        import traceback

        error_msg = f"Lỗi Server Nội bộ: {str(e)} - {traceback.format_exc()}"
        print(error_msg)  # Log to console
        raise HTTPException(status_code=500, detail=error_msg) from e


@router.post("/improve-schema")
async def improve_schema_endpoint(request: ImproveSchemaRequest):
    """
    Endpoint tối ưu hóa Schema bằng AI theo cấu hình của user.
    """
    try:
        improved = await schema_service.schema_optimizer.improve_schema(
            raw_schema=request.raw_schema,
            target_keyword=request.target_keyword,
            target_domain=request.target_domain,
            validation_errors=request.validation_errors,
            api_key=request.gemini_api_key,
        )
        return {"improved_schema": improved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
