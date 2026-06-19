from fastapi import APIRouter, HTTPException
from python_engine.schemas.keyword_schemas import (
    KeywordAnalysisRequest,
    KeywordDeepScanRequest,
    KeywordDeepScanResponse,
)
from python_engine.services import keyword_service
from python_engine.services.keyword_deep_scan_service import deep_scan_keyword

router = APIRouter()


@router.get("/health")
async def keyword_health_endpoint():
    """
    Kiểm tra nhanh các phần hay làm tool từ khóa lỗi: Python Engine, Playwright,
    pytrends và browser executable fallback.
    """
    try:
        from python_engine.services.keyword_deep_scan_service import resolve_chromium_executable_path

        return {
            "status": "ok",
            "playwright_import": True,
            "pytrends_import": keyword_service.TrendReq is not None,
            "browser_fallback": resolve_chromium_executable_path(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keyword health check lỗi: {str(e)}") from e


@router.post("/deep-scan", response_model=KeywordDeepScanResponse)
async def keyword_deep_scan_endpoint(request: KeywordDeepScanRequest):
    """
    Endpoint thực hiện phân tích từ khóa chuyên sâu.
    Có fallback HTTP nếu Playwright/Chromium chưa sẵn sàng.
    """
    try:
        result = await deep_scan_keyword(request.keyword)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích từ khóa: {str(e)}") from e


@router.post("/analyze")
async def keyword_analyze_endpoint(request: KeywordAnalysisRequest):
    """
    Endpoint phân tích từ khóa số lượng lớn (Demo/Bulk Mode).
    Hỗ trợ Autocomplete baiting, AI Intent và Trends.
    """
    try:
        results = await keyword_service.analyze_keywords_advanced(
            seed_keyword=request.seed_keyword,
            mode=request.mode,
            keyword_list=request.keyword_list,
            ranks=request.ranks,
            provider=request.provider,
            model=request.model,
            disable_ai=request.disable_ai,
            enable_cpc=request.enable_cpc,
            api_keys=request.api_keys,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích dữ liệu: {str(e)}") from e
