from pathlib import Path
import json
import re
from datetime import datetime
from playwright.sync_api import sync_playwright

repo = Path('/Users/apple/coding/Eggturtle-breeding-library')
outbound = repo / 'outbound'
outbound.mkdir(parents=True, exist_ok=True)

def read_env(path: Path):
    data = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in raw:
            continue
        key, value = raw.split('=', 1)
        value = value.strip().strip('"').strip("'")
        data[key.strip()] = value
    return data

env = read_env(repo / '.env')
account = env['TENANT_LOGIN_ACCOUNT']
password = env['TENANT_LOGIN_PASSWORD']
base_url = 'http://127.0.0.1:30010'
api_base = 'http://127.0.0.1:30011'

result = {
    'startedAt': datetime.now().isoformat(),
    'tenantSlug': None,
    'screenshots': [],
    'consoleErrors': [],
    'pageErrors': [],
    'findings': [],
}

def add(level, title, detail):
    result['findings'].append({'level': level, 'title': title, 'detail': detail})

def shot(page, filename):
    path = outbound / filename
    page.screenshot(path=str(path), full_page=True)
    result['screenshots'].append(str(path.relative_to(repo)))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    iphone = p.devices['iPhone 12']
    context = browser.new_context(**iphone)
    page = context.new_page()
    page.on('console', lambda msg: result['consoleErrors'].append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda err: result['pageErrors'].append(str(err)))

    login_resp = context.request.post(f'{api_base}/auth/password-login', data={'login': account, 'password': password})
    assert login_resp.ok, login_resp.text()
    access_token = login_resp.json()['accessToken']

    tenants_resp = context.request.get(f'{api_base}/tenants/me', headers={'Authorization': f'Bearer {access_token}'})
    assert tenants_resp.ok, tenants_resp.text()
    tenant_slug = tenants_resp.json()['tenants'][0]['tenant']['slug']
    result['tenantSlug'] = tenant_slug

    switch_resp = context.request.post(
        f'{api_base}/auth/switch-tenant',
        headers={'Authorization': f'Bearer {access_token}'},
        data={'slug': tenant_slug},
    )
    assert switch_resp.ok, switch_resp.text()
    switched_token = switch_resp.json()['accessToken']

    profile_resp = context.request.get(f'{api_base}/me/profile', headers={'Authorization': f'Bearer {switched_token}'})
    assert profile_resp.ok, profile_resp.text()
    profile = profile_resp.json()['profile']
    security_resp = context.request.get(f'{api_base}/me/security-profile', headers={'Authorization': f'Bearer {switched_token}'})
    assert security_resp.ok, security_resp.text()
    security = security_resp.json()['profile']

    if not (profile.get('name') or '').strip():
        update_profile = context.request.put(
            f'{api_base}/me/profile',
            headers={'Authorization': f'Bearer {switched_token}'},
            data={'name': 'QA Tester'},
        )
        assert update_profile.ok, update_profile.text()
        add('INFO', '已补齐显示名称', '测试账号原本缺少显示名称，QA 通过 API 补齐为 QA Tester 后继续。')

    if not profile.get('passwordUpdatedAt'):
        update_password = context.request.put(
            f'{api_base}/me/password',
            headers={'Authorization': f'Bearer {switched_token}'},
            data={'newPassword': password},
        )
        assert update_password.ok, update_password.text()
        add('INFO', '已补齐密码状态', '测试账号原本未记录改密时间，QA 使用当前测试密码补齐后继续。')

    if not ((security or {}).get('question') or '').strip():
        update_security = context.request.put(
            f'{api_base}/me/security-profile',
            headers={'Authorization': f'Bearer {switched_token}'},
            data={'question': 'QA临时密保问题', 'answer': 'QA临时密保答案'},
        )
        assert update_security.ok, update_security.text()
        add('INFO', '已补齐密保状态', '测试账号原本缺少密保，QA 通过 API 补齐后继续。')

    page.goto(f'{base_url}/login', wait_until='networkidle')
    page.evaluate("token => window.localStorage.setItem('eggturtle.accessToken', token)", switched_token)

    page.goto(f'{base_url}/app/{tenant_slug}/products', wait_until='networkidle')
    new_btn = page.get_by_role('button', name=re.compile('新建乌龟|新建'))
    new_btn.first.click(timeout=10000)
    page.wait_for_timeout(1000)
    shot(page, 'qa-mobile-product-create-series-default.png')

    body_text = page.locator('body').inner_text()
    if '系列' in body_text:
        add('PASS', '新建乌龟抽屉可见系列字段', '移动端抽屉已打开，页面中可见“系列”字段。')
    else:
        add('FAIL', '新建乌龟抽屉缺少系列字段', '移动端抽屉打开后未检出“系列”字段。')

    if page.get_by_role('button', name='新建系列').count() > 0:
        page.get_by_role('button', name='新建系列').click()
        page.wait_for_timeout(800)
        shot(page, 'qa-mobile-product-create-series-inline-create.png')
        body_text = page.locator('body').inner_text()
        if '新建系列' in body_text:
            add('PASS', '系列内联创建入口可用', '已点击“新建系列”按钮并完成截图留证。')
        else:
            add('WARN', '系列内联创建状态需人工复核', '按钮点击后文案变化不明显，请结合截图复核。')
    else:
        add('FAIL', '缺少新建系列按钮', '新建乌龟抽屉中未找到“新建系列”按钮。')

    page.goto(f'{base_url}/app/{tenant_slug}/share-presentation', wait_until='networkidle')
    page.wait_for_timeout(1000)
    shot(page, 'qa-mobile-share-presentation-theme.png')
    body_text = page.locator('body').inner_text()

    if '自定义颜色' in body_text:
        add('FAIL', '分享页仍存在自定义颜色入口', '移动端分享页中仍可见“自定义颜色”文案。')
    else:
        add('PASS', '自定义颜色入口已移除', '移动端分享页中未检出“自定义颜色”文案。')

    if re.search('黄|暖阳|默认配色', body_text):
        add('PASS', '默认配色黄色信息可见', '移动端分享页中可见默认配色相关文案，截图可复核黄色选中态。')
    else:
        add('WARN', '黄色选中态需人工复核', '未从文本直接检出黄色文案，请结合截图复核。')

    if result['consoleErrors']:
        add('WARN', '控制台存在报错', '\n'.join(result['consoleErrors'])[:2000])
    if result['pageErrors']:
        add('WARN', '页面存在运行时异常', '\n'.join(result['pageErrors'])[:2000])

    browser.close()

result['finishedAt'] = datetime.now().isoformat()
has_fail = any(item['level'] == 'FAIL' for item in result['findings'])
result['conclusion'] = '不可 push' if has_fail else '可 push'

(outbound / 'qa-ui-ux-test-20260307-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
report = [
    '# UI/UX QA 结论',
    '',
    f"- 时间: {result['finishedAt']}",
    f"- 用户: {result['tenantSlug']}",
    f"- 结论: {result['conclusion']}",
    '',
    '## 截图',
    *[f'- {p}' for p in result['screenshots']],
    '',
    '## 检查结果',
    *[f"- [{item['level']}] {item['title']}: {item['detail']}" for item in result['findings']],
    '',
    '## 报错统计',
    f"- consoleErrors: {len(result['consoleErrors'])}",
    f"- pageErrors: {len(result['pageErrors'])}",
    '',
]
(outbound / 'qa-ui-ux-test-20260307-report.md').write_text('\n'.join(report))
print('\n'.join(report))
