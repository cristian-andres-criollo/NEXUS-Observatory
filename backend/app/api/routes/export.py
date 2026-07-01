from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from app.schemas.code_review import CodeReviewResponse, RepoAnalysisResponse
from app.services.export_service import (
    export_code_review_markdown,
    export_repo_report_markdown,
    export_to_pdf,
)

router = APIRouter(prefix='/export', tags=['Export'])


class CodeReviewExportRequest(BaseModel):
    review_data: CodeReviewResponse


class RepoReportExportRequest(BaseModel):
    repo_data: RepoAnalysisResponse


@router.post('/code-review')
def export_code_review_markdown_route(req: CodeReviewExportRequest):
    try:
        markdown = export_code_review_markdown(req.review_data)
        return Response(
            content=markdown,
            media_type='text/markdown',
            headers={
                'Content-Disposition': 'attachment; filename="code-review-report.md"',
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'No se pudo generar el markdown: {exc}')


@router.post('/code-review/pdf')
def export_code_review_pdf_route(req: CodeReviewExportRequest):
    try:
        markdown = export_code_review_markdown(req.review_data)
        pdf_bytes = export_to_pdf(markdown, title='Code Review Report')
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': 'attachment; filename="code-review-report.pdf"',
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'No se pudo generar el PDF: {exc}')


@router.post('/repo-report')
def export_repo_report_markdown_route(req: RepoReportExportRequest):
    try:
        markdown = export_repo_report_markdown(req.repo_data)
        return Response(
            content=markdown,
            media_type='text/markdown',
            headers={
                'Content-Disposition': 'attachment; filename="repo-report.md"',
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'No se pudo generar el markdown: {exc}')


@router.post('/repo-report/pdf')
def export_repo_report_pdf_route(req: RepoReportExportRequest):
    try:
        markdown = export_repo_report_markdown(req.repo_data)
        pdf_bytes = export_to_pdf(markdown, title='Repo Analysis Report')
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': 'attachment; filename="repo-report.pdf"',
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'No se pudo generar el PDF: {exc}')
