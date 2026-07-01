import io
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import ListFlowable, ListItem, Paragraph, Preformatted, SimpleDocTemplate, Spacer
from app.schemas.code_review import CodeReviewResponse, RepoAnalysisResponse


def _escape_text(text: str) -> str:
    return (text.replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;'))


def export_code_review_markdown(review_data: CodeReviewResponse) -> str:
    lines = [
        '# Code Review Report',
        '',
        f'**Summary:** {review_data.summary}',
        '',
        '## Scores',
        '',
        f'- **Quality:** {review_data.quality_score:.2f}',
        f'- **Security:** {review_data.security_score:.2f}',
        f'- **Maintainability:** {review_data.maintainability_score:.2f}',
        '',
        '## Metrics',
        '',
        f'- **Tokens used:** {review_data.tokens_used}',
        f'- **Cost (USD):** ${review_data.cost_usd:.4f}',
        f'- **Latency (ms):** {review_data.latency_ms}',
        '',
        '## Issues',
        '',
    ]

    if review_data.issues:
        for issue in review_data.issues:
            line_info = f', line {issue.line}' if issue.line is not None else ''
            lines.extend([
                f'- **{issue.severity.upper()}**{line_info}',
                f'  - Description: {issue.description}',
                f'  - Suggestion: {issue.suggestion}',
                '',
            ])
    else:
        lines.extend(['- No issues detected', ''])

    if review_data.corrected_code:
        lines.extend(['## Corrected Code', '', '```', review_data.corrected_code.strip(), '```', ''])

    return '\n'.join(lines)


def export_repo_report_markdown(repo_data: RepoAnalysisResponse) -> str:
    lines = [
        '# Repo Analysis Report',
        '',
        f'**Repository:** {repo_data.repo_name}',
        '',
        f'**Summary:** {repo_data.summary}',
        '',
        '## Metrics',
        '',
        f'- **Files analyzed:** {repo_data.files_analyzed}',
        f'- **Issues found:** {repo_data.issues_found}',
        f'- **Quality score:** {repo_data.quality_score:.2f}',
        f'- **Tokens used:** {repo_data.tokens_used}',
        f'- **Cost (USD):** ${repo_data.cost_usd:.4f}',
        f'- **Latency (ms):** {repo_data.latency_ms}',
        '',
        '## Agent Steps',
        '',
    ]

    if repo_data.agent_steps:
        for step in repo_data.agent_steps:
            lines.extend([
                f'- **Paso {step.step}:** {step.action} ({step.status})',
            ])
            if step.input:
                lines.append(f'  - Input: {step.input}')
            if step.output:
                lines.append(f'  - Output: {step.output}')
            lines.append('')
    else:
        lines.extend(['- No agent steps available', ''])

    return '\n'.join(lines)


def export_to_pdf(markdown_content: str, title: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        alignment=TA_LEFT,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        'HeadingStyle',
        parent=styles['Heading2'],
        alignment=TA_LEFT,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['BodyText'],
        alignment=TA_LEFT,
        leading=14,
        spaceAfter=6,
    )
    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        backColor=colors.HexColor('#0f172a'),
        textColor=colors.HexColor('#e2e8f0'),
        leftIndent=6,
        rightIndent=6,
        spaceAfter=6,
    )

    story = [Paragraph(_escape_text(title), title_style), Spacer(1, 12)]
    list_items = []
    in_code_block = False
    code_buffer = []

    def flush_list():
        nonlocal list_items
        if list_items:
            story.append(ListFlowable(list_items, bulletType='bullet', start='circle', leftIndent=12, spaceAfter=6))
            list_items = []

    def flush_code():
        nonlocal code_buffer
        if code_buffer:
            story.append(Preformatted(_escape_text('\n'.join(code_buffer)), code_style))
            story.append(Spacer(1, 6))
            code_buffer = []

    for raw_line in markdown_content.splitlines():
        line = raw_line.rstrip()

        if line.startswith('```'):
            if in_code_block:
                flush_code()
                in_code_block = False
            else:
                in_code_block = True
            continue

        if in_code_block:
            code_buffer.append(line)
            continue

        if not line.strip():
            flush_list()
            story.append(Spacer(1, 8))
            continue

        if line.startswith('# '):
            flush_list()
            story.append(Paragraph(_escape_text(line[2:]), title_style))
            continue

        if line.startswith('## '):
            flush_list()
            story.append(Paragraph(_escape_text(line[3:]), heading_style))
            continue

        if line.startswith('- '):
            list_items.append(ListItem(Paragraph(_escape_text(line[2:]), body_style), leftIndent=0))
            continue

        if line.startswith('  - '):
            list_items.append(ListItem(Paragraph(_escape_text(line[4:]), body_style), leftIndent=18))
            continue

        flush_list()
        story.append(Paragraph(_escape_text(line), body_style))

    flush_code()
    flush_list()
    doc.build(story)
    buffer.seek(0)
    return buffer.read()
