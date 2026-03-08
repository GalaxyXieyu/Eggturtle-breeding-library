from pathlib import Path
from datetime import datetime
import json
import re
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

def parse_hex_color(value: str) -> str:
    s = (value or '').strip().lower()
    if re.fullmatch(r'#[0-9a-f]{6}', s):
        return s
    m = re.search(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', s)
    if not m:
        return s
    return '#' + ''.join(f'{int(part):02x}' for part in m.groups())

env = read_env(repo / '.env')
account = env['TENANT_LOGIN_ACCOUNT']
password = env['TENANT_LOGIN_PASSWORD']
base_url = 'http://127.0.0.1:30010'
api_base = 'http://127.0.0.1:30011'
code = f"ZZ{str(int(datetime.now().timestamp() * 1000))[-8:]}"

result = {
    'startedAt': datetime.now().isoformat(),
    'tenantSlug': None,
    'productId': None,
    'shareToken': None,
    'seriesId': None,
    'seriesCode': None,
    'seriesName': None,
    'screenshots': [],
    'consoleErrors': [],
    'pageErrors': [],
    'checks': [],
    'health': {},
}

def add(level, title, detail):
    result['checks'].append({'level': level, 'title': title, 'detail': detail})

def shot(page, filename):
    path = outbound / filename
    page.screenshot(path=str(path), full_page=True)
    result['screenshots'].append(str(path.relative_to(repo)))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1200})
    page = context.new_page()
    page.on('console', lambda msg: result['consoleErrors'].append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda err: result['pageErrors'].append(str(err)))

    health_resp = context.request.get(f'{api_base}/health')
    result['health']['api'] = health_resp.status
    add('PASS' if health_resp.ok else 'FAIL', '本地 API 健康检查', f'status={health_resp.status}')

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

    page.goto(f'{base_url}/login', wait_until='networkidle')
    page.evaluate("token => window.localStorage.setItem('eggturtle.accessToken', token)", switched_token)

    page.goto(f'{base_url}/app/{tenant_slug}/products', wait_until='networkidle')
    page.get_by_role('button', name='新建产品').click()
    page.wait_for_timeout(700)
    shot(page, 'retest-t65-create-drawer-default.png')

    series_select = page.locator('#create-drawer-series')
    new_series_button = page.get_by_role('button', name='新建系列')
    add(
        'PASS' if (series_select.is_visible() and new_series_button.is_visible()) else 'FAIL',
        '新建乌龟系列下拉 + 新建系列按钮是否顺手',
        f'selectBox={series_select.bounding_box()}; buttonBox={new_series_button.bounding_box()}',
    )

    new_series_button.click()
    page.wait_for_timeout(300)
    shot(page, 'retest-t65-create-drawer-new-series.png')
    page.locator('#create-drawer-code').fill(code)
    page.get_by_placeholder('系列名称（必填）').fill('白化')
    page.get_by_role('button', name='确认创建').click()
    page.wait_for_timeout(1800)

    body_after_create = page.locator('body').inner_text()
    if '创建成功' in body_after_create:
        add('PASS', '新建乌龟提交成功', body_after_create[:800])
    else:
        add('FAIL', '新建乌龟提交未返回成功态', body_after_create[:1200])

    product_resp = context.request.get(f'{api_base}/products?page=1&pageSize=50', headers={'Authorization': f'Bearer {switched_token}'})
    assert product_resp.ok, product_resp.text()
    products = product_resp.json().get('products', [])
    created = next((item for item in products if item.get('code') == code), None)
    assert created and created.get('id'), f'Created product not found via API for code={code}'
    result['productId'] = created['id']

    series_resp = context.request.get(f'{api_base}/series?page=1&pageSize=50', headers={'Authorization': f'Bearer {switched_token}'})
    assert series_resp.ok, series_resp.text()
    series_items = series_resp.json().get('items', [])
    series_map = {item['id']: item for item in series_items}
    created_series = series_map.get(created['seriesId'])
    result['seriesId'] = created.get('seriesId')
    result['seriesCode'] = created_series.get('code') if created_series else None
    result['seriesName'] = created_series.get('name') if created_series else None

    if created_series:
        add('PASS' if created_series.get('name') == '白化' else 'FAIL', '新建系列名称回显为白化', json.dumps(created_series, ensure_ascii=False))
        add('PASS' if created_series.get('code') == '白化' else 'FAIL', '新建系列编码未异常回显为产品编码/内部值', json.dumps(created_series, ensure_ascii=False))
        add('FAIL' if re.search(r'NEW-SERIES|\bNEW\b', json.dumps(created_series, ensure_ascii=False)) else 'PASS', '新建系列未回退成 NEW-SERIES/NEW', json.dumps(created_series, ensure_ascii=False))
    else:
        add('FAIL', '无法通过 API 找到新建系列', f'product={json.dumps(created, ensure_ascii=False)}')

    page.goto(f'{base_url}/app/{tenant_slug}/series', wait_until='networkidle')
    page.wait_for_timeout(1200)
    shot(page, 'retest-t65-series-page.png')
    series_page_text = page.locator('body').inner_text()
    add('PASS' if '白化' in series_page_text else 'FAIL', '系列页面可见白化', series_page_text[:1500])
    add('FAIL' if 'ID ' in series_page_text else 'PASS', '系列页面不应暴露内部 ID', series_page_text[:1500])
    add('FAIL' if result['seriesCode'] == code else 'PASS', '系列编码不应错误等于产品编码', f'productCode={code}; seriesCode={result["seriesCode"]}; seriesName={result["seriesName"]}')

    me_resp = context.request.get(f'{api_base}/me', headers={'Authorization': f'Bearer {switched_token}'})
    assert me_resp.ok, me_resp.text()
    tenant_id = me_resp.json()['tenantId']
    share_resp = context.request.post(
        f'{api_base}/shares',
        headers={'Authorization': f'Bearer {switched_token}'},
        data={'resourceType': 'tenant_feed', 'resourceId': tenant_id},
    )
    assert share_resp.ok, share_resp.text()
    result['shareToken'] = share_resp.json()['share']['shareToken']

    page.goto(f'{base_url}/app/{tenant_slug}/share-presentation', wait_until='networkidle')
    page.wait_for_timeout(1200)
    shot(page, 'retest-t69-share-presentation-initial.png')

    custom_color_count = page.get_by_text('自定义颜色', exact=True).count()
    add('FAIL' if custom_color_count > 0 else 'PASS', '分享配置取消自定义颜色后默认选中态是否为黄色 - 不应再有“自定义颜色”入口', f'customColorLabelCount={custom_color_count}')

    pressed_summaries = []
    color_buttons = page.locator('button[aria-pressed]')
    for i in range(color_buttons.count()):
        btn = color_buttons.nth(i)
        if btn.get_attribute('aria-pressed') == 'true':
            pressed_summaries.append({
                'text': btn.inner_text().strip(),
                'borderColor': parse_hex_color(btn.evaluate('(el) => getComputedStyle(el).borderColor')),
                'bgColor': parse_hex_color(btn.evaluate('(el) => getComputedStyle(el).backgroundColor')),
            })
    has_yellow_selected = any(item['text'].find('金黄') >= 0 or item['borderColor'] == '#ffd400' or item['bgColor'] == '#fff7d0' for item in pressed_summaries)
    add('PASS' if has_yellow_selected else 'FAIL', '分享配置默认选中态为黄色', json.dumps(pressed_summaries, ensure_ascii=False))

    color_input = page.locator('input[aria-label="主题主色 自定义颜色"]')
    if color_input.count() > 0:
        color_input.fill('#06b6d4')
        page.get_by_role('button', name='保存并立即生效').click()
        page.wait_for_timeout(1200)
        page.get_by_role('button', name='金黄').click()
        page.get_by_role('button', name='保存并立即生效').click()
        page.wait_for_timeout(1200)
        shot(page, 'retest-t69-share-presentation-after-reset-to-yellow.png')
        current_color_count = page.get_by_text('当前色', exact=True).count()
        add('FAIL' if current_color_count > 0 else 'PASS', '历史自定义颜色不应残留为“当前色”', f'currentColorTextCount={current_color_count}')

    browser.close()

result['finishedAt'] = datetime.now().isoformat()
result['conclusion'] = '不可 push' if any(item['level'] == 'FAIL' for item in result['checks']) else '可 push'
(outbound / 'retest-t65-t69-20260307-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
report = [
    '# Retest T65/T69',
    '',
    f"- time: {result['finishedAt']}",
    f"- tenant: {result['tenantSlug']}",
    f"- productId: {result['productId']}",
    f"- seriesId: {result['seriesId']}",
    f"- seriesCode: {result['seriesCode']}",
    f"- seriesName: {result['seriesName']}",
    f"- shareToken: {result['shareToken']}",
    f"- conclusion: {result['conclusion']}",
    '',
    '## Screenshots',
    *[f'- {item}' for item in result['screenshots']],
    '',
    '## Checks',
    *[f"- [{item['level']}] {item['title']}: {item['detail']}" for item in result['checks']],
    '',
    f"- consoleErrors: {len(result['consoleErrors'])}",
    f"- pageErrors: {len(result['pageErrors'])}",
    '',
]
(outbound / 'retest-t65-t69-20260307-report.md').write_text('\n'.join(report))
print('\n'.join(report))
