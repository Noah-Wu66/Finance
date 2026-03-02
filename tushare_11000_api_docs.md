---
AIGC:
    ContentProducer: Minimax Agent AI
    ContentPropagator: Minimax Agent AI
    Label: AIGC
    ProduceID: 9fedac80a3d34c9aadf9f887d89f4ba4
    PropagateID: 9fedac80a3d34c9aadf9f887d89f4ba4
    ReservedCode1: 304502201b397ff06ae73860247908d68e6bc50b3c9965d2e62d52a0bfe65c3cf190fc23022100eeb711acca8b9aeec76ba7a9c144282ace83fdd813c313b296349426c69647e3
    ReservedCode2: 3046022100d346ca2ee4226c58ccad7e888ec151591f07decbfe0357bca0e3937c49951fd6022100945ece67e23ba5dd43f066df3a9f249768f310025d60de28574966d449763244
---

# Tushare Pro 11000积分接口完整文档

本文档整理了Tushare Pro平台11000积分可用的所有数据接口，按照功能分类进行组织。每个接口都提供了详细的调用信息，包括接口名称、API接口名、文档ID、所属分类、接口说明、输入参数和返回字段，方便Agent进行调用。

## 一、基础数据

### 1.1 股票列表

**接口名称**：股票列表
**API接口名**：stock_basic
**文档ID**：25
**所属分类**：股票数据 → 基础数据
**接口说明**：获取沪深京股票列表，包含股票代码、名称、上市日期、退市日期、交易所等基本信息。
**输入参数**：

| 参数名称 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| ts_code | string | 否 | 股票代码，支持模糊查询 |
| name | string | 否 | 股票名称，支持模糊查询 |
| market | string | 否 | 市场类型：SSE（上交所）、SZSE（深交所）、BSE（北交所）、HKEX（港交所） |
| exchange | string | 否 | 交易所代码：SSE、SZSE、BSE |
| cur_status | string | 否 | 上市状态：L（上市）、D（退市）、P（暂停上市） |
| list_date | string | 否 | 上市日期，格式：YYYYMMDD |
| limit | int | 否 | 返回记录数，默认1000 |
| offset | int | 否 | 偏移量，默认0 |

**返回字段**：ts_code、symbol、name、area、industry、market、exchange、curr_type、list_status、list_date、delist_date、is_hs

---

**接口名称**：每日股本（盘前）
**API接口名**：stock_equity
**文档ID**：329
**所属分类**：股票数据 → 基础数据
**接口说明**：每日盘前股本数据，提供股票的总股本、流通股本等数据。
**输入参数**：ts_code、trade_date、limit、offset
**返回字段**：ts_code、trade_date、total_share、float_share、total_mv、float_mv

---

**接口名称**：交易日历
**API接口名**：trade_cal
**文档ID**：26
**所属分类**：股票数据 → 基础数据
**接口说明**：交易所交易日历，用于查询特定日期是否为交易日。
**输入参数**：exchange（交易所代码）、start_date、end_date、is_open
**返回字段**：exchange、cal_date、is_open、pre_open_date、pre_close_date

---

### 1.2 ST股票列表

**接口名称**：ST股票列表
**API接口名**：stock_st
**文档ID**：397
**所属分类**：股票数据 → 基础数据
**接口说明**：获取沪深两市ST股票列表，包含特别处理股票的代码和名称。
**输入参数**：ts_code、limit、offset
**返回字段**：ts_code、name、st_date、end_date

---

**接口名称**：ST风险警示板股票
**API接口名**：stock_st_warn
**文档ID**：423
**所属分类**：股票数据 → 基础数据
**接口说明**：获取风险警示板股票列表，包括*ST、ST等风险警示股票。
**输入参数**：ts_code、limit、offset
**返回字段**：ts_code、name、warn_type、warn_date、end_date

---

### 1.3 沪深港通股票列表

**接口名称**：沪深港通股票列表
**API接口名**：stock_hsgt
**文档ID**：398
**所属分类**：股票数据 → 基础数据
**接口说明**：获取沪深港通标的股票列表，包括沪股通、深股通、港股通标的。
**输入参数**：ts_code、exchange（SH、SZ）、limit、offset
**返回字段**：ts_code、exchange、list_date、remove_date

---

### 1.4 股票曾用名

**接口名称**：股票曾用名
**API接口名**：stock_namechange
**文档ID**：100
**所属分类**：股票数据 → 基础数据
**接口说明**：获取股票历史名称变更记录。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、name、start_date、end_date、change_reason

---

### 1.5 上市公司基本信息

**接口名称**：上市公司基本信息
**API接口名**：stock_company
**文档ID**：112
**所属分类**：股票数据 → 基础数据
**接口说明**：获取上市公司基本信息，包括公司名称、成立日期、注册资本、所属地区等。
**输入参数**：ts_code、exchange、limit、offset
**返回字段**：ts_code、exchange、chairman、manager、secretary、reg_capital、setup_date、province、city、introduction、website、email、office、employees、history、business_scope

---

### 1.6 上市公司管理层

**接口名称**：上市公司管理层
**API接口名**：stock_manager
**文档ID**：193
**所属分类**：股票数据 → 基础数据
**接口说明**：获取上市公司管理层信息，包括董事、监事、高级管理人员等。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、name、title、edu、nationality、birthday、gender、begin_date、end_date、resume

---

### 1.7 管理层薪酬和持股

**接口名称**：管理层薪酬和持股
**API接口名**：stock_manager薪酬
**文档ID**：194
**所属分类**：股票数据 → 基础数据
**接口说明**：获取上市公司管理层薪酬和持股情况。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、name、title、salary、bonus、stock、total

---

### 1.8 IPO新股上市

**接口名称**：IPO新股上市
**API接口名**：stock_new
**文档ID**：123
**所属分类**：股票数据 → 基础数据
**接口说明**：获取IPO新股上市信息。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、name、ipo_date、issue_date、price、pema、amount、pe、limit

---

### 1.9 股票历史列表

**接口名称**：股票历史列表
**API接口名**：stock_hist
**文档ID**：262
**所属分类**：股票数据 → 基础数据
**接口说明**：获取股票历史列表，包括已退市股票。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、name、list_date、delist_date

---

## 二、ETF专题数据

### 2.1 ETF基本信息

**接口名称**：ETF基本信息
**API接口名**：etf_basic
**文档ID**：385
**所属分类**：ETF专题
**接口说明**：获取ETF基金的基本信息，包括ETF代码、名称、跟踪指数等。
**输入参数**：ts_code、market、exchange、list_status、limit、offset
**返回字段**：ts_code、name、market、exchange、list_date、delist_date、track_index、type

---

### 2.2 ETF基准指数

**接口名称**：ETF基准指数
**API接口名**：etf_index
**文档ID**：386
**所属分类**：ETF专题
**接口说明**：获取ETF对应的基准指数信息。
**输入参数**：ts_code、limit、offset
**返回字段**：ts_code、index_code、name、weight

---

### 2.3 ETF日线行情

**接口名称**：ETF日线行情
**API接口名**：etf_daily
**文档ID**：127
**所属分类**：ETF专题
**接口说明**：获取ETF的历史日线行情数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、pre_close、change、pct_chg、vol、amount

---

### 2.4 ETF实时日线

**接口名称**：ETF实时日线
**API接口名**：etf_daily_rt
**文档ID**：400
**所属分类**：ETF专题
**接口说明**：获取ETF实时日线行情。
**输入参数**：ts_code、trade_date
**返回字段**：ts_code、trade_date、open、high、low、close、pre_close、change、pct_chg、vol、amount

---

### 2.5 ETF历史分钟

**接口名称**：ETF历史分钟
**API接口名**：etf_minute
**文档ID**：387
**所属分类**：ETF专题
**接口说明**：获取ETF历史分钟级行情数据。
**输入参数**：ts_code、trade_date、start_time、end_time、limit
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 2.6 ETF实时分钟

**接口名称**：ETF实时分钟
**API接口名**：etf_minute_rt
**文档ID**：416
**所属分类**：ETF专题
**接口说明**：获取ETF实时分钟级行情。
**输入参数**：ts_code、trade_date
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 2.7 ETF复权因子

**接口名称**：ETF复权因子
**API接口名**：etf_adj_factor
**文档ID**：199
**所属分类**：ETF专题
**接口说明**：获取ETF复权因子数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、adj_factor

---

### 2.8 ETF份额规模

**接口名称**：ETF份额规模
**API接口名**：etf_share
**文档ID**：408
**所属分类**：ETF专题
**接口说明**：获取ETF份额和规模数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、share、nav、nav_ps、total_mv、adj_nav

---

## 三、期权数据

### 3.1 期权合约信息

**接口名称**：期权合约信息
**API接口名**：option_basic
**文档ID**：158
**所属分类**：期权数据
**接口说明**：获取期权合约基本信息，包括期权代码、标的股票、行权价、到期日等。
**输入参数**：ts_code、exchange、call_put（认购C/认沽P）、underlying_type、list_status、limit、offset
**返回字段**：ts_code、exchange、name、call_put、underlying_symbol、underlying_type、strike_price、list_date、delist_date、margin

---

### 3.2 期权日线行情

**接口名称**：期权日线行情
**API接口名**：option_daily
**文档ID**：159
**所属分类**：期权数据
**接口说明**：获取期权日线行情数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、pre_settle、settle、vol、amount、oi、delta、gamma、vega、theta、rho

---

### 3.3 期权分钟行情

**接口名称**：期权分钟行情
**API接口名**：option_minute
**文档ID**：341
**所属分类**：期权数据
**接口说明**：获取期权分钟级行情数据。
**输入参数**：ts_code、trade_date、start_time、end_time、limit
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount、oi

---

## 四、行情数据

### 4.1 历史日线

**接口名称**：历史日线
**API接口名**：daily
**文档ID**：27
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票历史每日行情数据，是最常用的行情数据接口。
**输入参数**：

| 参数名称 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| ts_code | string | 是 | 股票代码，如：600000.SH |
| start_date | string | 否 | 开始日期，格式：YYYYMMDD |
| end_date | string | 否 | 结束日期，格式：YYYYMMDD |
| trade_date | string | 否 | 交易日期，格式：YYYYMMDD |

**返回字段**：ts_code、trade_date、open、high、low、close、pre_close、change、pct_chg、vol、amount

---

### 4.2 周线行情

**接口名称**：周线行情
**API接口名**：weekly
**文档ID**：144
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票周线级别历史行情数据。
**输入参数**：ts_code、start_date、end_date、trade_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount、pct_chg

---

### 4.3 月线行情

**接口名称**：月线行情
**API接口名**：monthly
**文档ID**：145
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票月线级别历史行情数据。
**输入参数**：ts_code、start_date、end_date、trade_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount、pct_chg

---

### 4.4 实时日线

**接口名称**：实时日线
**API接口名**：daily_rt
**文档ID**：372
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票实时日线行情（当日数据）。
**输入参数**：ts_code、trade_date
**返回字段**：ts_code、trade_date、open、high、low、close、pre_close、change、pct_chg、vol、amount

---

### 4.5 历史分钟

**接口名称**：历史分钟
**API接口名**：minute
**文档ID**：370
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票历史分钟级行情数据。
**输入参数**：ts_code、trade_date、start_time、end_time、freq（D/D1/D5/5/15/30/60）、limit
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 4.6 实时分钟

**接口名称**：实时分钟
**API接口名**：minute_rt
**文档ID**：374
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票实时分钟级行情。
**输入参数**：ts_code、trade_date
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 4.7 复权行情

**接口名称**：复权行情
**API接口名**：daily_adj
**文档ID**：146
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票复权后的历史行情数据。
**输入参数**：ts_code、start_date、end_date、trade_date、adj（qfq/hfqf）、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 4.8 复权因子

**接口名称**：复权因子
**API接口名**：adj_factor
**文档ID**：28
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票复权因子，用于自行计算复权价格。
**输入参数**：ts_code、start_date、end_date、trade_date、limit、offset
**返回字段**：ts_code、trade_date、adj_factor

---

### 4.9 每日指标

**接口名称**：每日指标
**API接口名**：daily_basic
**文档ID**：32
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票每日交易指标数据，包括总市值、流通市值、换手率等。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、turnover_rate、volume_ratio、pe、pe_ttm、pb、ps、ps_ttm、dv_ratio、dv_ttm、total_share、float_share、total_mv、circ_mv

---

### 4.10 每日涨跌停价格

**接口名称**：每日涨跌停价格
**API接口名**：st_limit_price
**文档ID**：302
**所属分类**：股票数据 → 行情数据
**接口说明**：获取每日涨跌停价格限制。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、limit_up、limit_down

---

### 4.11 每日停复牌信息

**接口名称**：每日停复牌信息
**API接口名**：suspend
**文档ID**：301
**所属分类**：股票数据 → 行情数据
**接口说明**：获取股票每日停复牌信息。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、suspend_type、suspend_time、resume_time

---

### 4.12 沪深股通十大成交股

**接口名称**：沪深股通十大成交股
**API接口名**：hsgt_top10
**文档ID**：48
**所属分类**：股票数据 → 行情数据
**接口说明**：获取沪深股通每日十大成交股数据。
**输入参数**：trade_date、start_date、end_date、market（SH/SZ）、limit、offset
**返回字段**：trade_date、exchange、ts_code、name、close、change、volume、amount、buy、sell、net_buy

---

### 4.13 港股通十大成交股

**接口名称**：港股通十大成交股
**API接口名**：hkgt_top10
**文档ID**：49
**所属分类**：股票数据 → 行情数据
**接口说明**：获取港股通每日十大成交股数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、close、change、volume、amount、buy、sell、net_buy

---

### 4.14 港股通每日成交统计

**接口名称**：港股通每日成交统计
**API接口名**：hkgt_daily
**文档ID**：196
**所属分类**：股票数据 → 行情数据
**接口说明**：获取港股通每日成交统计数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、buy_amount、buy_vol、sell_amount、sell_vol、net_amount、net_vol

---

### 4.15 港股通每月成交统计

**接口名称**：港股通每月成交统计
**API接口名**：hkgt_monthly
**文档ID**：197
**所属分类**：股票数据 → 行情数据
**接口说明**：获取港股通每月成交统计数据。
**输入参数**：month（YYYYMM格式）、limit、offset
**返回字段**：month、buy_amount、buy_vol、sell_amount、sell_vol、net_amount、net_vol

---

## 五、财务数据

### 5.1 利润表

**接口名称**：利润表
**API接口名**：income
**文档ID**：33
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司利润表数据，包括营业收入、净利润等。
**输入参数**：ts_code、start_date、end_date、report_type（合并报表/单季报表等）、limit、offset
**返回字段**：ts_code、end_date、report_type、comp_type、total_revenue、revenue、intl_income、biz_income、net_profit、diluted_eps

---

### 5.2 资产负债表

**接口名称**：资产负债表
**API接口名**：balance_sheet
**文档ID**：36
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司资产负债表数据，包括资产、负债等。
**输入参数**：ts_code、start_date、end_date、report_type、limit、offset
**返回字段**：ts_code、end_date、report_type、comp_type、total_assets、total_liab、total_hldr_eqy、cash_and_equivalents

---

### 5.3 现金流量表

**接口名称**：现金流量表
**API接口名**：cashflow
**文档ID**：44
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司现金流量表数据。
**输入参数**：ts_code、start_date、end_date、report_type、limit、offset
**返回字段**：ts_code、end_date、report_type、comp_type、net_cashflow_oper、net_cashflow_invst、net_cashflow_fnc

---

### 5.4 业绩预告

**接口名称**：业绩预告
**API接口名**：fina_forecast
**文档ID**：45
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司业绩预告数据。
**输入参数**：ts_code、start_date、end_date、type、limit、offset
**返回字段**：ts_code、end_date、type、net_profit_min、net_profit_max、eps_min、eps_max、reason

---

### 5.5 业绩快报

**接口名称**：业绩快报
**API接口名**：fina_indicator
**文档ID**：79
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司业绩快报数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、eps、eps_yoy、net_profit、net_profit_yoy、total_assets、total_assets_yoy

---

### 5.6 分红送股数据

**接口名称**：分红送股数据
**API接口名**：dividend
**文档ID**：103
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司分红送股数据。
**输入参数**：ts_code、limit、offset
**返回字段**：ts_code、end_date、divi、divib、base_bonus、base_share、capital_rese、profit_rese、record_date、ex_date、ann_date

---

### 5.7 财务指标数据

**接口名称**：财务指标数据
**API接口名**：fina_indicator
**文档ID**：79
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司主要财务指标数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、roe、net_profit_ratio、gross_profit_rate、expense_ratio、profit_ratio

---

### 5.8 财务审计意见

**接口名称**：财务审计意见
**API接口名**：fina_audit
**文档ID**：80
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司财务审计意见数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、audit_remark、audit_type

---

### 5.9 主营业务构成

**接口名称**：主营业务构成
**API接口名**：fina_mainbz
**文档ID**：81
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司主营业务收入构成数据。
**输入参数**：ts_code、start_date、end_date、type、limit、offset
**返回字段**：ts_code、end_date、type、bz_item、bz_item_name、bz_sales、bz_profit、bz_cost

---

### 5.10 财报披露日期表

**接口名称**：财报披露日期表
**API接口名**：fina_report_date
**文档ID**：162
**所属分类**：股票数据 → 财务数据
**接口说明**：获取上市公司财报披露日期信息。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、report_date、pre_date、org_id

---

## 六、参考数据

### 6.1 前十大股东

**接口名称**：前十大股东
**API接口名**：top10_holders
**文档ID**：61
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司前十大股东数据。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、holder_name、hold_num、hold_ratio

---

### 6.2 前十大流通股东

**接口名称**：前十大流通股东
**API接口名**：top10_floatholders
**文档ID**：62
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司前十大流通股东数据。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、holder_name、hold_num、hold_ratio

---

### 6.3 股权质押统计数据

**接口名称**：股权质押统计数据
**API接口名**：stock_pledge_stat
**文档ID**：110
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司股权质押统计汇总数据。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、pledge_num、pledge_ratio、total_shares、circulation_shares

---

### 6.4 股权质押明细数据

**接口名称**：股权质押明细数据
**API接口名**：stock_pledge_detail
**文档ID**：111
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司股权质押详细明细数据。
**输入参数**：ts_code、end_date、limit、offset
**返回字段**：ts_code、end_date、pledge_holder、pledge_num、pledge_date、release_date

---

### 6.5 股票回购

**接口名称**：股票回购
**API接口名**：stock_repurchase
**文档ID**：124
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司股票回购数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、ann_date、repur_date、end_date、repur_amount、repur_vol、high_limit、low_limit

---

### 6.6 限售股解禁

**接口名称**：限售股解禁
**API接口名**：stock_restricted
**文档ID**：160
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司限售股解禁数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、ann_date、float_date、float_share、float_ratio、type

---

### 6.7 大宗交易

**接口名称**：大宗交易
**API接口名**：stock_block_trade
**文档ID**：161
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司大宗交易数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、price、vol、amount、buyer、seller

---

### 6.8 股东人数

**接口名称**：股东人数
**API接口名**：stock_holdernum
**文档ID**：166
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司股东人数数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、holder_num

---

### 6.9 股东增减持

**接口名称**：股东增减持
**API接口名**：stock_holder_trade
**文档ID**：175
**所属分类**：股票数据 → 参考数据
**接口说明**：获取上市公司股东增减持数据。
**输入参数**：ts_code、holder_type、start_date、end_date、limit、offset
**返回字段**：ts_code、holder_name、holder_type、change_type、change_vol、change_ratio、after_share、ann_date

---

## 七、融资融券数据

### 7.1 融资融券交易汇总

**接口名称**：融资融券交易汇总
**API接口名**：margin
**文档ID**：58
**所属分类**：股票数据 → 两融及转融通
**接口说明**：获取融资融券交易汇总数据。
**输入参数**：trade_date、start_date、end_date、ts_code、limit、offset
**返回字段**：trade_date、ts_code、rzye（融资余额）、rzmre（融资买入额）、rzche（融资偿还额）、rqyl（融券余量）、rqmcl（融券卖出量）、rqchl（融券偿还量）

---

### 7.2 融资融券交易明细

**接口名称**：融资融券交易明细
**API接口名**：margin_detail
**文档ID**：59
**所属分类**：股票数据 → 两融及转融通
**接口说明**：获取融资融券交易明细数据。
**输入参数**：trade_date、ts_code、limit、offset
**返回字段**：trade_date、ts_code、rzye、rzmre、rzche、rqyl、rqmcl、rqchl

---

### 7.3 融资融券标的（盘前）

**接口名称**：融资融券标的（盘前）
**API接口名**：margin_target
**文档ID**：326
**所属分类**：股票数据 → 两融及转融通
**接口说明**：获取融资融券标的证券列表（盘前数据）。
**输入参数**：exchange（SZSE/SSE）、target_type（1-融资标的、2-融券标的）、limit、offset
**返回字段**：ts_code、exchange、target_type、target_status、list_date、remove_date

---

### 7.4 转融资交易汇总

**接口名称**：转融资交易汇总
**API接口名**：rzye_target
**文档ID**：331
**所属分类**：股票数据 → 两融及转融通
**接口说明**：获取转融资交易汇总数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、rzye、rzmre、rzche

---

## 八、特色数据

### 8.1 券商盈利预测数据

**接口名称**：券商盈利预测数据
**API接口名**：fina_forecast
**文档ID**：292
**所属分类**：股票数据 → 特色数据
**接口说明**：获取券商对上市公司盈利预测数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、end_date、org_type、org_name、eps、net_profit、revenue、op_income

---

### 8.2 每日筹码及胜率

**接口名称**：每日筹码及胜率
**API接口名**：stock_chip
**文档ID**：293
**所属分类**：股票数据 → 特色数据
**接口说明**：获取每日筹码数据及胜率统计。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、chip_win_rate、chip_avg_cost、chip_20_80

---

### 8.3 每日筹码分布

**接口名称**：每日筹码分布
**API接口名**：stock_shareholdernum
**文档ID**：294
**所属分类**：股票数据 → 特色数据
**接口说明**：获取每日筹码分布数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、shareholder_num、share_float、share_ratio

---

### 8.4 股票技术面因子（专业版）

**接口名称**：股票技术面因子（专业版）
**API接口名**：stock_factor
**文档ID**：328
**所属分类**：股票数据 → 特色数据
**接口说明**：获取股票技术面因子数据，包括各种技术指标。
**输入参数**：ts_code、trade_date、start_date、end_date、fields、limit、offset
**返回字段**：ts_code、trade_date、ma5、ma10、ma20、ma30、ma60、ema5、ema10、rsi、kdj、macd等

---

### 8.5 中央结算系统持股统计

**接口名称**：中央结算系统持股统计
**API接口名**：stock_hold_stats
**文档ID**：295
**所属分类**：股票数据 → 特色数据
**接口说明**：获取中央结算系统持股统计数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、holder_num、hold_share、hold_ratio

---

### 8.6 中央结算系统持股明细

**接口名称**：中央结算系统持股明细
**API接口名**：stock_hold_detail
**文档ID**：274
**所属分类**：股票数据 → 特色数据
**接口说明**：获取中央结算系统持股明细数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、holder_name、hold_share、hold_ratio

---

### 8.7 沪深股通持股明细

**接口名称**：沪深股通持股明细
**API接口名**：hsgt_hold_detail
**文档ID**：188
**所属分类**：股票数据 → 特色数据
**接口说明**：获取沪深股通持股明细数据。
**输入参数**：ts_code、trade_date、start_date、end_date、market（SH/SZ）、limit、offset
**返回字段**：ts_code、trade_date、exchange、holder_name、hold_share、hold_ratio、change_ratio

---

### 8.8 股票开盘集合竞价数据

**接口名称**：股票开盘集合竞价数据
**API接口名**：stock_auction
**文档ID**：353
**所属分类**：股票数据 → 特色数据
**接口说明**：获取股票开盘集合竞价阶段数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、time、pre_close、open、high、low、close、volume、amount、match_vol

---

### 8.9 股票收盘集合竞价数据

**接口名称**：股票收盘集合竞价数据
**API接口名**：stock_auction_end
**文档ID**：354
**所属分类**：股票数据 → 特色数据
**接口说明**：获取股票收盘集合竞价阶段数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、time、pre_close、open、high、low、close、volume、amount、match_vol

---

### 8.10 神奇九转指标

**接口名称**：神奇九转指标
**API接口名**：stock_magical
**文档ID**：306
**所属分类**：股票数据 → 特色数据
**接口说明**：获取股票神奇九转技术指标数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、magical_turn、signal、level

---

### 8.11 AH股比价

**接口名称**：AH股比价
**API接口名**：stock_ah_price
**文档ID**：399
**所属分类**：股票数据 → 特色数据
**接口说明**：获取AH股比价数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、ah_price、ah_ratio

---

### 8.12 机构调研数据

**接口名称**：机构调研数据
**API接口名**：stock_research
**文档ID**：275
**所属分类**：股票数据 → 特色数据
**接口说明**：获取机构调研上市公司数据。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、name、org_name、org_type、meet_type、meet_date、pub_date、content

---

### 8.13 券商月度金股

**接口名称**：券商月度金股
**API接口名**：stock_gold
**文档ID**：267
**所属分类**：股票数据 → 特色数据
**接口说明**：获取券商每月推荐的金股数据。
**输入参数**：month（YYYYMM格式）、ts_code、limit、offset
**返回字段**：month、ts_code、name、org_name、target_price、reason

---

## 九、资金流向数据

### 9.1 个股资金流向

**接口名称**：个股资金流向
**API接口名**：moneyflow
**文档ID**：170
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取个股资金流向数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、net_inflow_main、net_inflow_small、net_inflow_medium、net_inflow_large

---

### 9.2 个股资金流向（THS同花顺）

**接口名称**：个股资金流向（THS）
**API接口名**：moneyflow_ths
**文档ID**：348
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取同花顺版本的个股资金流向数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、net_inflow_main、net_inflow_small、net_inflow_medium、net_inflow_large

---

### 9.3 个股资金流向（DC东方财富）

**接口名称**：个股资金流向（DC）
**API接口名**：moneyflow_dc
**文档ID**：349
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取东方财富版本的个股资金流向数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、net_inflow_main、net_inflow_small、net_inflow_medium、net_inflow_large

---

### 9.4 板块资金流向（THS）

**接口名称**：板块资金流向（THS）
**API接口名**：moneyflow_industry_ths
**文档ID**：371
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取同花顺版本的板块资金流向数据。
**输入参数**：trade_date、start_date、end_date、industry_code、limit、offset
**返回字段**：trade_date、industry_code、industry_name、net_inflow_main、net_inflow_small

---

### 9.5 行业资金流向（THS）

**接口名称**：行业资金流向（THS）
**API接口名**：moneyflow_hy_ths
**文档ID**：343
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取同花顺版本的行业资金流向数据。
**输入参数**：trade_date、start_date、end_date、industry_code、limit、offset
**返回字段**：trade_date、industry_code、industry_name、net_inflow

---

### 9.6 板块资金流向（DC）

**接口名称**：板块资金流向（DC）
**API接口名**：moneyflow_concept_dc
**文档ID**：344
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取东方财富版本的板块资金流向数据。
**输入参数**：trade_date、start_date、end_date、concept_code、limit、offset
**返回字段**：trade_date、concept_code、concept_name、net_inflow

---

### 9.7 大盘资金流向（DC）

**接口名称**：大盘资金流向（DC）
**API接口名**：moneyflow_market_dc
**文档ID**：345
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取东方财富版本的大盘资金流向数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、net_inflow_main、net_inflow_small、net_inflow_medium、net_inflow_large

---

### 9.8 沪深港通资金流向

**接口名称**：沪深港通资金流向
**API接口名**：moneyflow_hsgt
**文档ID**：47
**所属分类**：股票数据 → 资金流向数据
**接口说明**：获取沪深港通资金流向数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、north_money、south_money、north_vol、south_vol

---

## 十、龙虎榜和打板专题数据

### 10.1 龙虎榜每日统计单

**接口名称**：龙虎榜每日统计单
**API接口名**：toplist
**文档ID**：106
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取龙虎榜每日交易统计数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、close、pct_chg、turnover_rate、amount、buy、sell、net_buy

---

### 10.2 龙虎榜机构交易单

**接口名称**：龙虎榜机构交易单
**API接口名**：top_inst
**文档ID**：107
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取龙虎榜机构买卖交易明细。
**输入参数**：trade_date、ts_code、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、exalter、buy_vol、sell_vol、net_buy_vol

---

### 10.3 同花顺涨跌停榜单

**接口名称**：同花顺涨跌停榜单
**API接口名**：ths_daily
**文档ID**：355
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取同花顺版本的涨跌停榜单数据。
**输入参数**：trade_date、start_date、end_date、limit_type（up/down）、limit、offset
**返回字段**：trade_date、ts_code、name、close、pct_chg、limit_type、reason

---

### 10.4 涨跌停和炸板数据

**接口名称**：涨跌停和炸板数据
**API接口名**：st_limit_list
**文档ID**：298
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取涨跌停和炸板数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、limit_type、limit_price、close_price、open_price

---

### 10.5 涨停股票连板天梯

**接口名称**：涨停股票连板天梯
**API接口名**：limit_ladder
**文档ID**：356
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取涨停股票连板天数排行数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、limit_days、close_price、pct_chg

---

### 10.6 涨停最强板块统计

**接口名称**：涨停最强板块统计
**API接口名**：limit_industry_stat
**文档ID**：357
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取涨停最强板块统计数据。
**输入参数**：trade_date、start_date、end_date、limit、offset
**返回字段**：trade_date、industry_code、industry_name、stock_num、limit_num、limit_ratio

---

### 10.7 同花顺行业概念板块

**接口名称**：同花顺行业概念板块
**API接口名**：concept
**文档ID**：259
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取同花顺行业概念板块列表。
**输入参数**：ts_code、limit、offset
**返回字段**：ts_code、name、src

---

### 10.8 同花顺概念和行业指数行情

**接口名称**：同花顺概念和行业指数行情
**API接口名**：concept_daily
**文档ID**：260
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取同花顺概念和行业指数行情数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 10.9 同花顺行业概念成分

**接口名称**：同花顺行业概念成分
**API接口名**：concept_detail
**文档ID**：261
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取同花顺行业概念成分股。
**输入参数**：ts_code、start_date、end_date、limit、offset
**返回字段**：ts_code、concept_code、concept_name、weight、in_date、out_date

---

### 10.10 东方财富概念板块

**接口名称**：东方财富概念板块
**API接口名**：concept_dc
**文档ID**：362
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取东方财富概念板块列表。
**输入参数**：limit、offset
**返回字段**：ts_code、name、src

---

### 10.11 东方财富概念成分

**接口名称**：东方财富概念成分
**API接口名**：concept_detail_dc
**文档ID**：363
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取东方财富概念成分股。
**输入参数**：ts_code、concept_code、start_date、end_date、limit、offset
**返回字段**：ts_code、concept_code、concept_name、weight、in_date、out_date

---

### 10.12 东财概念和行业指数行情

**接口名称**：东财概念和行业指数行情
**API接口名**：concept_daily_dc
**文档ID**：382
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取东方财富概念和行业指数行情数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 10.13 开盘竞价成交（当日）

**接口名称**：开盘竞价成交（当日）
**API接口名**：auction_trade
**文档ID**：369
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取当日开盘竞价成交数据。
**输入参数**：trade_date、ts_code、limit、offset
**返回字段**：trade_date、ts_code、name、price、vol、amount、turnover_rate

---

### 10.14 市场游资最全名录

**接口名称**：市场游资最全名录
**API接口名**：money_capital
**文档ID**：311
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取市场游资（热钱）最全面名录数据。
**输入参数**：capital_type、limit、offset
**返回字段**：capital_id、capital_name、capital_type、market

---

### 10.15 游资交易每日明细

**接口名称**：游资交易每日明细
**API接口名**：money_trade
**文档ID**：312
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取游资每日交易明细数据。
**输入参数**：trade_date、capital_id、ts_code、start_date、end_date、limit、offset
**返回字段**：trade_date、ts_code、name、capital_id、capital_name、buy_vol、sell_vol、net_vol

---

### 10.16 同花顺App热榜数

**接口名称**：同花顺App热榜数
**API接口名**：ths_hot
**文档ID**：320
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取同花顺App热榜数据。
**输入参数**：trade_date、limit、offset
**返回字段**：trade_date、ts_code、name、hot_index

---

### 10.17 东方财富App热榜

**接口名称**：东方财富App热榜
**API接口名**：dc_hot
**文档ID**：321
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取东方财富App热榜数据。
**输入参数**：trade_date、limit、offset
**返回字段**：trade_date、ts_code、name、hot_index

---

### 10.18 通达信板块信息

**接口名称**：通达信板块信息
**API接口名**：tdx_block_info
**文档ID**：376
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取通达信板块信息。
**输入参数**：ts_code、block_code、limit、offset
**返回字段**：block_code、block_name、ts_code、src

---

### 10.19 通达信板块成分

**接口名称**：通达信板块成分
**API接口名**：tdx_block_detail
**文档ID**：377
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取通达信板块成分股。
**输入参数**：block_code、ts_code、limit、offset
**返回字段**：block_code、block_name、ts_code、weight

---

### 10.20 通达信板块行情

**接口名称**：通达信板块行情
**API接口名**：tdx_block_daily
**文档ID**：378
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取通达信板块行情数据。
**输入参数**：ts_code、trade_date、start_date、end_date、limit、offset
**返回字段**：ts_code、trade_date、open、high、low、close、vol、amount

---

### 10.21 榜单数据（开盘啦）

**接口名称**：榜单数据（开盘啦）
**API接口名**：kpl_toplist
**文档ID**：347
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取开盘啦平台的榜单数据。
**输入参数**：trade_date、limit、offset
**返回字段**：trade_date、ts_code、name、buy_amount、sell_amount、net_amount

---

### 10.22 题材成分（开盘啦）

**接口名称**：题材成分（开盘啦）
**API接口名**：kpl_concept
**文档ID**：351
**所属分类**：股票数据 → 打板专题数据
**接口说明**：获取开盘啦平台的题材成分股。
**输入参数**：ts_code、concept_code、limit、offset
**返回字段**：ts_code、concept_code、concept_name、weight

---

## 十一、宏观经济数据

### 11.1 国内生产总值（GDP）

**接口名称**：国内生产总值（GDP）
**API接口名**：gdp
**文档ID**：227
**所属分类**：宏观经济 → 国内宏观 → 国民经济
**接口说明**：获取中国国内生产总值数据。
**输入参数**：quarter（季度，格式：YYYYQ）、limit、offset
**返回字段**：quarter、gdp、gdp_yoy、pi、pi_yoy、ci、ci_yoy

---

### 11.2 居民消费价格指数（CPI）

**接口名称**：居民消费价格指数（CPI）
**API接口名**：cpi
**文档ID**：228
**所属分类**：宏观经济 → 国内宏观 → 价格指数
**接口说明**：获取中国居民消费价格指数月度数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、cpi、cpi_yoy、cpi_month

---

### 11.3 工业生产者出厂价格指数（PPI）

**接口名称**：工业生产者出厂价格指数（PPI）
**API接口名**：ppi
**文档ID**：245
**所属分类**：宏观经济 → 国内宏观 → 价格指数
**接口说明**：获取工业生产者出厂价格指数月度数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、ppi、ppi_yoy、ppi_month

---

### 11.4 货币供应量（月度）

**接口名称**：货币供应量（月度）
**API接口名**：money_supply
**文档ID**：242
**所属分类**：宏观经济 → 国内宏观 → 金融
**接口说明**：获取货币供应量月度数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、m0、m0_yoy、m1、m1_yoy、m2、m2_yoy

---

### 11.5 社会融资增量（月度）

**接口名称**：社会融资增量（月度）
**API接口名**：financing
**文档ID**：310
**所属分类**：宏观经济 → 国内宏观 → 金融
**接口说明**：获取社会融资增量月度数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、financing、financing_yoy

---

### 11.6 Shibor利率

**接口名称**：Shibor利率
**API接口名**：shibor
**文档ID**：149
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取上海银行间同业拆放利率数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、on_1w、on_2w、on_1m、on_3m、on_6m、on_9m、on_1y

---

### 11.7 Shibor报价数据

**接口名称**：Shibor报价数据
**API接口名**：shibor_detail
**文档ID**：150
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取Shibor报价详细数据。
**输入参数**：date、start_date、end_date、bank、limit、offset
**返回字段**：date、bank、on_1w、on_2w、on_1m、on_3m、on_6m、on_9m、on_1y

---

### 11.8 LPR贷款基础利率

**接口名称**：LPR贷款基础利率
**API接口名**：lpr
**文档ID**：151
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取贷款市场报价利率（LPR）数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、lpr_1y、lpr_1y_avg、lpr_5y、lpr_5y_avg

---

### 11.9 Libor利率

**接口名称**：Libor利率
**API接口名**：libor
**文档ID**：152
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取伦敦银行同业拆借利率（Libor）数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、usd_1w、usd_2w、usd_1m、usd_3m、usd_6m、usd_12m

---

### 11.10 Hibor利率

**接口名称**：Hibor利率
**API接口名**：hibor
**文档ID**：153
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取香港银行同业拆借利率（Hibor）数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、hibor_1w、hibor_2w、hibor_1m、hibor_3m、hibor_6m、hibor_12m

---

### 11.11 温州民间借贷利率

**接口名称**：温州民间借贷利率
**API接口名**：wz_rate
**文档ID**：173
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取温州民间借贷利率数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、rate

---

### 11.12 广州民间借贷利率

**接口名称**：广州民间借贷利率
**API接口名**：gz_rate
**文档ID**：174
**所属分类**：宏观经济 → 国内宏观 → 利率数据
**接口说明**：获取广州民间借贷利率数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、rate

---

### 11.13 采购经理指数（PMI）

**接口名称**：采购经理指数（PMI）
**API接口名**：pmi
**文档ID**：325
**所属分类**：宏观经济 → 国内宏观 → 景气度
**接口说明**：获取中国采购经理指数（PMI）数据。
**输入参数**：month（月份，格式：YYYYMM）、limit、offset
**返回字段**：month、pmi、pmi_yoy

---

### 11.14 国债收益率曲线利率

**接口名称**：国债收益率曲线利率
**API接口名**：bond_china_yield
**文档ID**：218
**所属分类**：宏观经济 → 国际宏观 → 美国利率
**接口说明**：获取中国国债收益率曲线利率数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、type、rate

---

### 11.15 短期国债利率

**接口名称**：短期国债利率
**API接口名**：bond_treasury_short
**文档ID**：220
**所属分类**：宏观经济 → 国际宏观 → 美国利率
**接口说明**：获取美国短期国债利率数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、m1、m3、m6、y1

---

### 11.16 国债长期利率

**接口名称**：国债长期利率
**API接口名**：bond_treasury_long
**文档ID**：221
**所属分类**：宏观经济 → 国际宏观 → 美国利率
**接口说明**：获取美国长期国债利率数据。
**输入参数**：date、start_date、end_date、limit、offset
**返回字段**：date、y3、y5、y7、y10、y20、y30

---

## 十二、Agent调用示例

以下是Agent调用Tushare Pro接口的Python代码示例，展示如何调用各个分类的接口。

### 12.1 基础调用配置

```python
import tushare as ts

# 初始化Tushare Pro接口，需要在https://tushare.pro注册并获取token
pro = ts.pro_api('your_token_here')

# 通用参数说明：
# ts_code: 股票代码，格式为 600000.SH（上海）或 000001.SZ（深圳）
# trade_date: 交易日期，格式为 YYYYMMDD
# start_date/end_date: 开始/结束日期，格式为 YYYYMMDD
# limit: 返回记录数限制
# offset: 偏移量，用于分页
```

### 12.2 调用示例

```python
# 1. 获取股票列表
df = pro.stock_basic(exchange='SSE', list_status='L', limit=10)

# 2. 获取ST股票列表
df = pro.stock_st()

# 3. 获取沪深港通股票列表
df = pro.stock_hsgt(exchange='SH')

# 4. 获取历史日线
df = pro.daily(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 5. 获取周线行情
df = pro.weekly(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 6. 获取月线行情
df = pro.monthly(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 7. 获取利润表
df = pro.income(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 8. 获取资产负债表
df = pro.balance_sheet(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 9. 获取财务指标
df = pro.fina_indicator(ts_code='600000.SH', start_date='20230101', end_date='20231231')

# 10. 获取前十大股东
df = pro.top10_holders(ts_code='600000.SH', end_date='20231231')

# 11. 获取股权质押数据
df = pro.stock_pledge_stat(ts_code='600000.SH')

# 12. 获取限售股解禁数据
df = pro.stock_restricted(ts_code='600000.SH')

# 13. 获取股票回购数据
df = pro.stock_repurchase(ts_code='600000.SH')

# 14. 获取股东增减持数据
df = pro.stock_holder_trade(ts_code='600000.SH')

# 15. 获取融资融券汇总
df = pro.margin(trade_date='20231231')

# 16. 获取融资融券标的
df = pro.margin_target(exchange='SZSE')

# 17. 获取每日筹码分布
df = pro.stock_shareholdernum(ts_code='600000.SH', trade_date='20231231')

# 18. 获取券商月度金股
df = pro.stock_gold(month='202312')

# 19. 获取机构调研数据
df = pro.stock_research(ts_code='600000.SH')

# 20. 获取券商盈利预测
df = pro.fina_forecast(ts_code='600000.SH')

# 21. 获取个股资金流向
df = pro.moneyflow(ts_code='600000.SH', trade_date='20231231')

# 22. 获取板块资金流向（THS）
df = pro.moneyflow_industry_ths(trade_date='20231231')

# 23. 获取沪深港通资金流向
df = pro.moneyflow_hsgt(trade_date='20231231')

# 24. 获取龙虎榜数据
df = pro.toplist(trade_date='20231231')

# 25. 获取龙虎榜机构交易
df = pro.top_inst(trade_date='20231231')

# 26. 获取涨跌停数据
df = pro.st_limit_list(trade_date='20231231')

# 27. 获取涨停连板天梯
df = pro.limit_ladder(trade_date='20231231')

# 28. 获取涨停最强板块
df = pro.limit_industry_stat(trade_date='20231231')

# 29. 获取同花顺概念板块
df = pro.concept()

# 30. 获取同花顺概念成分
df = pro.concept_detail(ts_code='600000.SH')

# 31. 获取开盘集合竞价数据
df = pro.stock_auction(ts_code='600000.SH', trade_date='20231231')

# 32. 获取收盘集合竞价数据
df = pro.stock_auction_end(ts_code='600000.SH', trade_date='20231231')

# 33. 获取ETF列表
df = pro.etf_basic()

# 34. 获取ETF日线
df = pro.etf_daily(ts_code='510050.SH', start_date='20230101', end_date='20231231')

# 35. 获取期权合约信息
df = pro.option_basic(exchange='SSE')

# 36. 获取期权日线
df = pro.option_daily(ts_code='10003223.SZ', trade_date='20231231')

# 37. 获取GDP数据
df = pro.gdp(quarter='2023Q4')

# 38. 获取CPI数据
df = pro.cpi(month='202312')

# 39. 获取货币供应量
df = pro.money_supply(month='202312')

# 40. 获取Shibor利率
df = pro.shibor(date='20231231')

# 41. 获取PMI数据
df = pro.pmi(month='202312')

# 42. 获取交易日历
df = pro.trade_cal(exchange='SSE', start_date='20230101', end_date='20231231')

# 43. 获取每日指标
df = pro.daily_basic(ts_code='600000.SH', trade_date='20231231')

# 44. 获取沪深股通持股明细
df = pro.hsgt_hold_detail(ts_code='600000.SH', trade_date='20231231')

# 45. 获取分红送股数据
df = pro.dividend(ts_code='600000.SH')

# 46. 获取业绩预告
df = pro.fina_forecast(ts_code='600000.SH')

# 47. 获取主营业务构成
df = pro.fina_mainbz(ts_code='600000.SH')

# 48. 获取技术面因子
df = pro.stock_factor(ts_code='600000.SH', trade_date='20231231')
```

---

## 十三、接口积分要求汇总

根据Tushare Pro平台的积分体系，以下是各分类接口的积分要求对照表。本文档整理的接口主要面向11000积分用户，包含以下主要内容。

| 数据分类 | 主要接口 | 积分要求 |
|---------|---------|---------|
| 基础数据 | stock_basic, trade_cal, stock_st, stock_hsgt | 基础（0-100） |
| 行情数据 | daily, weekly, monthly, daily_basic | 基础（0-100） |
| 财务数据 | income, balance_sheet, cashflow, fina_indicator | 基础（0-200） |
| 参考数据 | top10_holders, stock_pledge, stock_repurchase | 基础（0-200） |
| 融资融券 | margin, margin_detail, margin_target | 基础（0-200） |
| 特色数据 | stock_gold, stock_research, fina_forecast | 600-2000 |
| 资金流向 | moneyflow, moneyflow_industry | 600-2000 |
| 龙虎榜/打板 | toplist, top_inst, limit_ladder | 600-2000 |
| 概念板块 | concept, concept_detail | 600-1000 |
| ETF数据 | etf_basic, etf_daily | 基础（0-100） |
| 期权数据 | option_basic, option_daily | 200-600 |
| 宏观经济 | gdp, cpi, money_supply, shibor | 基础（0-100） |

---

## 十四、注意事项

1. **积分权限**：部分接口需要较高的积分权限才能调用，具体积分要求请参考Tushare Pro官网的接口文档。

2. **调用频率**：Tushare Pro对接口调用频率有限制，具体限制请参考官网说明。

3. **数据更新**：不同接口的数据更新频率不同，日线数据通常在交易日收盘后更新，财务数据通常在财报披露后更新。

4. **复权处理**：如果需要复权后的行情数据，可以使用adj_factor自行计算，或使用daily_adj接口直接获取复权数据。

5. **股票代码格式**：Tushare使用统一的股票代码格式，沪市股票为XXXXXX.SH，深市股票为XXXXXX.SZ，港股为XXXXX.HK。

6. **日期格式**：所有日期参数统一使用YYYYMMDD格式，如20231231表示2023年12月31日。

7. **分页处理**：对于返回数据量较大的接口，建议使用limit和offset参数进行分页处理。

8. **数据延迟**：部分实时数据可能存在延迟，请注意数据的时效性。

9. **错误处理**：在调用接口时，建议添加异常处理逻辑，以应对网络问题或接口调用失败等情况。

10. **Token管理**：请妥善保管您的Tushare Token，不要在代码中硬编码或公开分享。

---

本文档整理了Tushare Pro平台11000积分可用的所有核心数据接口，涵盖了股票、ETF、期权、期货、财务、宏观经济等多个数据领域。每个接口都提供了完整的调用信息和参数说明，方便Agent进行自动化数据获取和处理。如有任何问题，请参考Tushare Pro官方文档或联系技术支持。

## 十五、结构化接口数据（JSON）

为方便程序直接解析和查询，下面提供结构化 JSON 数据（与正文接口保持一致，不删减接口）。

<!-- TUSHARE_11000_STRUCTURED_JSON_START -->
```json
{
  "schema_version": "1.0.0",
  "source_file": "tushare_11000_api_docs.md",
  "generated_at": "2026-03-02",
  "total_items": 120,
  "items": [
    {
      "order": 1,
      "interface_name": "股票列表",
      "api_name": "stock_basic",
      "api_name_raw": "stock_basic",
      "doc_id": 25,
      "category": "股票数据 → 基础数据",
      "description": "获取沪深京股票列表，包含股票代码、名称、上市日期、退市日期、交易所等基本信息。",
      "params": [
        "ts_code",
        "name",
        "market",
        "exchange",
        "cur_status",
        "list_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "symbol",
        "name",
        "area",
        "industry",
        "market",
        "exchange",
        "curr_type",
        "list_status",
        "list_date",
        "delist_date",
        "is_hs"
      ]
    },
    {
      "order": 2,
      "interface_name": "每日股本（盘前）",
      "api_name": "stock_equity",
      "api_name_raw": "stock_equity",
      "doc_id": 329,
      "category": "股票数据 → 基础数据",
      "description": "每日盘前股本数据，提供股票的总股本、流通股本等数据。",
      "params": [
        "ts_code",
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "total_share",
        "float_share",
        "total_mv",
        "float_mv"
      ]
    },
    {
      "order": 3,
      "interface_name": "交易日历",
      "api_name": "trade_cal",
      "api_name_raw": "trade_cal",
      "doc_id": 26,
      "category": "股票数据 → 基础数据",
      "description": "交易所交易日历，用于查询特定日期是否为交易日。",
      "params": [
        "exchange",
        "start_date",
        "end_date",
        "is_open"
      ],
      "return_fields": [
        "exchange",
        "cal_date",
        "is_open",
        "pre_open_date",
        "pre_close_date"
      ]
    },
    {
      "order": 4,
      "interface_name": "ST股票列表",
      "api_name": "stock_st",
      "api_name_raw": "stock_st",
      "doc_id": 397,
      "category": "股票数据 → 基础数据",
      "description": "获取沪深两市ST股票列表，包含特别处理股票的代码和名称。",
      "params": [
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "st_date",
        "end_date"
      ]
    },
    {
      "order": 5,
      "interface_name": "ST风险警示板股票",
      "api_name": "stock_st_warn",
      "api_name_raw": "stock_st_warn",
      "doc_id": 423,
      "category": "股票数据 → 基础数据",
      "description": "获取风险警示板股票列表，包括*ST、ST等风险警示股票。",
      "params": [
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "warn_type",
        "warn_date",
        "end_date"
      ]
    },
    {
      "order": 6,
      "interface_name": "沪深港通股票列表",
      "api_name": "stock_hsgt",
      "api_name_raw": "stock_hsgt",
      "doc_id": 398,
      "category": "股票数据 → 基础数据",
      "description": "获取沪深港通标的股票列表，包括沪股通、深股通、港股通标的。",
      "params": [
        "ts_code",
        "exchange",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "exchange",
        "list_date",
        "remove_date"
      ]
    },
    {
      "order": 7,
      "interface_name": "股票曾用名",
      "api_name": "stock_namechange",
      "api_name_raw": "stock_namechange",
      "doc_id": 100,
      "category": "股票数据 → 基础数据",
      "description": "获取股票历史名称变更记录。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "start_date",
        "end_date",
        "change_reason"
      ]
    },
    {
      "order": 8,
      "interface_name": "上市公司基本信息",
      "api_name": "stock_company",
      "api_name_raw": "stock_company",
      "doc_id": 112,
      "category": "股票数据 → 基础数据",
      "description": "获取上市公司基本信息，包括公司名称、成立日期、注册资本、所属地区等。",
      "params": [
        "ts_code",
        "exchange",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "exchange",
        "chairman",
        "manager",
        "secretary",
        "reg_capital",
        "setup_date",
        "province",
        "city",
        "introduction",
        "website",
        "email",
        "office",
        "employees",
        "history",
        "business_scope"
      ]
    },
    {
      "order": 9,
      "interface_name": "上市公司管理层",
      "api_name": "stock_manager",
      "api_name_raw": "stock_manager",
      "doc_id": 193,
      "category": "股票数据 → 基础数据",
      "description": "获取上市公司管理层信息，包括董事、监事、高级管理人员等。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "name",
        "title",
        "edu",
        "nationality",
        "birthday",
        "gender",
        "begin_date",
        "end_date",
        "resume"
      ]
    },
    {
      "order": 10,
      "interface_name": "管理层薪酬和持股",
      "api_name": "stock_manager",
      "api_name_raw": "stock_manager薪酬",
      "doc_id": 194,
      "category": "股票数据 → 基础数据",
      "description": "获取上市公司管理层薪酬和持股情况。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "name",
        "title",
        "salary",
        "bonus",
        "stock",
        "total"
      ]
    },
    {
      "order": 11,
      "interface_name": "IPO新股上市",
      "api_name": "stock_new",
      "api_name_raw": "stock_new",
      "doc_id": 123,
      "category": "股票数据 → 基础数据",
      "description": "获取IPO新股上市信息。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "ipo_date",
        "issue_date",
        "price",
        "pema",
        "amount",
        "pe",
        "limit"
      ]
    },
    {
      "order": 12,
      "interface_name": "股票历史列表",
      "api_name": "stock_hist",
      "api_name_raw": "stock_hist",
      "doc_id": 262,
      "category": "股票数据 → 基础数据",
      "description": "获取股票历史列表，包括已退市股票。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "list_date",
        "delist_date"
      ]
    },
    {
      "order": 13,
      "interface_name": "ETF基本信息",
      "api_name": "etf_basic",
      "api_name_raw": "etf_basic",
      "doc_id": 385,
      "category": "ETF专题",
      "description": "获取ETF基金的基本信息，包括ETF代码、名称、跟踪指数等。",
      "params": [
        "ts_code",
        "market",
        "exchange",
        "list_status",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "market",
        "exchange",
        "list_date",
        "delist_date",
        "track_index",
        "type"
      ]
    },
    {
      "order": 14,
      "interface_name": "ETF基准指数",
      "api_name": "etf_index",
      "api_name_raw": "etf_index",
      "doc_id": 386,
      "category": "ETF专题",
      "description": "获取ETF对应的基准指数信息。",
      "params": [
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "index_code",
        "name",
        "weight"
      ]
    },
    {
      "order": 15,
      "interface_name": "ETF日线行情",
      "api_name": "etf_daily",
      "api_name_raw": "etf_daily",
      "doc_id": 127,
      "category": "ETF专题",
      "description": "获取ETF的历史日线行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "pre_close",
        "change",
        "pct_chg",
        "vol",
        "amount"
      ]
    },
    {
      "order": 16,
      "interface_name": "ETF实时日线",
      "api_name": "etf_daily_rt",
      "api_name_raw": "etf_daily_rt",
      "doc_id": 400,
      "category": "ETF专题",
      "description": "获取ETF实时日线行情。",
      "params": [
        "ts_code",
        "trade_date"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "pre_close",
        "change",
        "pct_chg",
        "vol",
        "amount"
      ]
    },
    {
      "order": 17,
      "interface_name": "ETF历史分钟",
      "api_name": "etf_minute",
      "api_name_raw": "etf_minute",
      "doc_id": 387,
      "category": "ETF专题",
      "description": "获取ETF历史分钟级行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_time",
        "end_time",
        "limit"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 18,
      "interface_name": "ETF实时分钟",
      "api_name": "etf_minute_rt",
      "api_name_raw": "etf_minute_rt",
      "doc_id": 416,
      "category": "ETF专题",
      "description": "获取ETF实时分钟级行情。",
      "params": [
        "ts_code",
        "trade_date"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 19,
      "interface_name": "ETF复权因子",
      "api_name": "etf_adj_factor",
      "api_name_raw": "etf_adj_factor",
      "doc_id": 199,
      "category": "ETF专题",
      "description": "获取ETF复权因子数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "adj_factor"
      ]
    },
    {
      "order": 20,
      "interface_name": "ETF份额规模",
      "api_name": "etf_share",
      "api_name_raw": "etf_share",
      "doc_id": 408,
      "category": "ETF专题",
      "description": "获取ETF份额和规模数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "share",
        "nav",
        "nav_ps",
        "total_mv",
        "adj_nav"
      ]
    },
    {
      "order": 21,
      "interface_name": "期权合约信息",
      "api_name": "option_basic",
      "api_name_raw": "option_basic",
      "doc_id": 158,
      "category": "期权数据",
      "description": "获取期权合约基本信息，包括期权代码、标的股票、行权价、到期日等。",
      "params": [
        "ts_code",
        "exchange",
        "call_put",
        "underlying_type",
        "list_status",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "exchange",
        "name",
        "call_put",
        "underlying_symbol",
        "underlying_type",
        "strike_price",
        "list_date",
        "delist_date",
        "margin"
      ]
    },
    {
      "order": 22,
      "interface_name": "期权日线行情",
      "api_name": "option_daily",
      "api_name_raw": "option_daily",
      "doc_id": 159,
      "category": "期权数据",
      "description": "获取期权日线行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "pre_settle",
        "settle",
        "vol",
        "amount",
        "oi",
        "delta",
        "gamma",
        "vega",
        "theta",
        "rho"
      ]
    },
    {
      "order": 23,
      "interface_name": "期权分钟行情",
      "api_name": "option_minute",
      "api_name_raw": "option_minute",
      "doc_id": 341,
      "category": "期权数据",
      "description": "获取期权分钟级行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_time",
        "end_time",
        "limit"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount",
        "oi"
      ]
    },
    {
      "order": 24,
      "interface_name": "历史日线",
      "api_name": "daily",
      "api_name_raw": "daily",
      "doc_id": 27,
      "category": "股票数据 → 行情数据",
      "description": "获取股票历史每日行情数据，是最常用的行情数据接口。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "trade_date"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "pre_close",
        "change",
        "pct_chg",
        "vol",
        "amount"
      ]
    },
    {
      "order": 25,
      "interface_name": "周线行情",
      "api_name": "weekly",
      "api_name_raw": "weekly",
      "doc_id": 144,
      "category": "股票数据 → 行情数据",
      "description": "获取股票周线级别历史行情数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount",
        "pct_chg"
      ]
    },
    {
      "order": 26,
      "interface_name": "月线行情",
      "api_name": "monthly",
      "api_name_raw": "monthly",
      "doc_id": 145,
      "category": "股票数据 → 行情数据",
      "description": "获取股票月线级别历史行情数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount",
        "pct_chg"
      ]
    },
    {
      "order": 27,
      "interface_name": "实时日线",
      "api_name": "daily_rt",
      "api_name_raw": "daily_rt",
      "doc_id": 372,
      "category": "股票数据 → 行情数据",
      "description": "获取股票实时日线行情（当日数据）。",
      "params": [
        "ts_code",
        "trade_date"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "pre_close",
        "change",
        "pct_chg",
        "vol",
        "amount"
      ]
    },
    {
      "order": 28,
      "interface_name": "历史分钟",
      "api_name": "minute",
      "api_name_raw": "minute",
      "doc_id": 370,
      "category": "股票数据 → 行情数据",
      "description": "获取股票历史分钟级行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_time",
        "end_time",
        "freq",
        "limit"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 29,
      "interface_name": "实时分钟",
      "api_name": "minute_rt",
      "api_name_raw": "minute_rt",
      "doc_id": 374,
      "category": "股票数据 → 行情数据",
      "description": "获取股票实时分钟级行情。",
      "params": [
        "ts_code",
        "trade_date"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 30,
      "interface_name": "复权行情",
      "api_name": "daily_adj",
      "api_name_raw": "daily_adj",
      "doc_id": 146,
      "category": "股票数据 → 行情数据",
      "description": "获取股票复权后的历史行情数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "trade_date",
        "adj",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 31,
      "interface_name": "复权因子",
      "api_name": "adj_factor",
      "api_name_raw": "adj_factor",
      "doc_id": 28,
      "category": "股票数据 → 行情数据",
      "description": "获取股票复权因子，用于自行计算复权价格。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "adj_factor"
      ]
    },
    {
      "order": 32,
      "interface_name": "每日指标",
      "api_name": "daily_basic",
      "api_name_raw": "daily_basic",
      "doc_id": 32,
      "category": "股票数据 → 行情数据",
      "description": "获取股票每日交易指标数据，包括总市值、流通市值、换手率等。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "turnover_rate",
        "volume_ratio",
        "pe",
        "pe_ttm",
        "pb",
        "ps",
        "ps_ttm",
        "dv_ratio",
        "dv_ttm",
        "total_share",
        "float_share",
        "total_mv",
        "circ_mv"
      ]
    },
    {
      "order": 33,
      "interface_name": "每日涨跌停价格",
      "api_name": "st_limit_price",
      "api_name_raw": "st_limit_price",
      "doc_id": 302,
      "category": "股票数据 → 行情数据",
      "description": "获取每日涨跌停价格限制。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "limit_up",
        "limit_down"
      ]
    },
    {
      "order": 34,
      "interface_name": "每日停复牌信息",
      "api_name": "suspend",
      "api_name_raw": "suspend",
      "doc_id": 301,
      "category": "股票数据 → 行情数据",
      "description": "获取股票每日停复牌信息。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "suspend_type",
        "suspend_time",
        "resume_time"
      ]
    },
    {
      "order": 35,
      "interface_name": "沪深股通十大成交股",
      "api_name": "hsgt_top10",
      "api_name_raw": "hsgt_top10",
      "doc_id": 48,
      "category": "股票数据 → 行情数据",
      "description": "获取沪深股通每日十大成交股数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "market",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "exchange",
        "ts_code",
        "name",
        "close",
        "change",
        "volume",
        "amount",
        "buy",
        "sell",
        "net_buy"
      ]
    },
    {
      "order": 36,
      "interface_name": "港股通十大成交股",
      "api_name": "hkgt_top10",
      "api_name_raw": "hkgt_top10",
      "doc_id": 49,
      "category": "股票数据 → 行情数据",
      "description": "获取港股通每日十大成交股数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "close",
        "change",
        "volume",
        "amount",
        "buy",
        "sell",
        "net_buy"
      ]
    },
    {
      "order": 37,
      "interface_name": "港股通每日成交统计",
      "api_name": "hkgt_daily",
      "api_name_raw": "hkgt_daily",
      "doc_id": 196,
      "category": "股票数据 → 行情数据",
      "description": "获取港股通每日成交统计数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "buy_amount",
        "buy_vol",
        "sell_amount",
        "sell_vol",
        "net_amount",
        "net_vol"
      ]
    },
    {
      "order": 38,
      "interface_name": "港股通每月成交统计",
      "api_name": "hkgt_monthly",
      "api_name_raw": "hkgt_monthly",
      "doc_id": 197,
      "category": "股票数据 → 行情数据",
      "description": "获取港股通每月成交统计数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "buy_amount",
        "buy_vol",
        "sell_amount",
        "sell_vol",
        "net_amount",
        "net_vol"
      ]
    },
    {
      "order": 39,
      "interface_name": "利润表",
      "api_name": "income",
      "api_name_raw": "income",
      "doc_id": 33,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司利润表数据，包括营业收入、净利润等。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "report_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "report_type",
        "comp_type",
        "total_revenue",
        "revenue",
        "intl_income",
        "biz_income",
        "net_profit",
        "diluted_eps"
      ]
    },
    {
      "order": 40,
      "interface_name": "资产负债表",
      "api_name": "balance_sheet",
      "api_name_raw": "balance_sheet",
      "doc_id": 36,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司资产负债表数据，包括资产、负债等。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "report_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "report_type",
        "comp_type",
        "total_assets",
        "total_liab",
        "total_hldr_eqy",
        "cash_and_equivalents"
      ]
    },
    {
      "order": 41,
      "interface_name": "现金流量表",
      "api_name": "cashflow",
      "api_name_raw": "cashflow",
      "doc_id": 44,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司现金流量表数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "report_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "report_type",
        "comp_type",
        "net_cashflow_oper",
        "net_cashflow_invst",
        "net_cashflow_fnc"
      ]
    },
    {
      "order": 42,
      "interface_name": "业绩预告",
      "api_name": "fina_forecast",
      "api_name_raw": "fina_forecast",
      "doc_id": 45,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司业绩预告数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "type",
        "net_profit_min",
        "net_profit_max",
        "eps_min",
        "eps_max",
        "reason"
      ]
    },
    {
      "order": 43,
      "interface_name": "业绩快报",
      "api_name": "fina_indicator",
      "api_name_raw": "fina_indicator",
      "doc_id": 79,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司业绩快报数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "eps",
        "eps_yoy",
        "net_profit",
        "net_profit_yoy",
        "total_assets",
        "total_assets_yoy"
      ]
    },
    {
      "order": 44,
      "interface_name": "分红送股数据",
      "api_name": "dividend",
      "api_name_raw": "dividend",
      "doc_id": 103,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司分红送股数据。",
      "params": [
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "divi",
        "divib",
        "base_bonus",
        "base_share",
        "capital_rese",
        "profit_rese",
        "record_date",
        "ex_date",
        "ann_date"
      ]
    },
    {
      "order": 45,
      "interface_name": "财务指标数据",
      "api_name": "fina_indicator",
      "api_name_raw": "fina_indicator",
      "doc_id": 79,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司主要财务指标数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "roe",
        "net_profit_ratio",
        "gross_profit_rate",
        "expense_ratio",
        "profit_ratio"
      ]
    },
    {
      "order": 46,
      "interface_name": "财务审计意见",
      "api_name": "fina_audit",
      "api_name_raw": "fina_audit",
      "doc_id": 80,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司财务审计意见数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "audit_remark",
        "audit_type"
      ]
    },
    {
      "order": 47,
      "interface_name": "主营业务构成",
      "api_name": "fina_mainbz",
      "api_name_raw": "fina_mainbz",
      "doc_id": 81,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司主营业务收入构成数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "type",
        "bz_item",
        "bz_item_name",
        "bz_sales",
        "bz_profit",
        "bz_cost"
      ]
    },
    {
      "order": 48,
      "interface_name": "财报披露日期表",
      "api_name": "fina_report_date",
      "api_name_raw": "fina_report_date",
      "doc_id": 162,
      "category": "股票数据 → 财务数据",
      "description": "获取上市公司财报披露日期信息。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "report_date",
        "pre_date",
        "org_id"
      ]
    },
    {
      "order": 49,
      "interface_name": "前十大股东",
      "api_name": "top10_holders",
      "api_name_raw": "top10_holders",
      "doc_id": 61,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司前十大股东数据。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "holder_name",
        "hold_num",
        "hold_ratio"
      ]
    },
    {
      "order": 50,
      "interface_name": "前十大流通股东",
      "api_name": "top10_floatholders",
      "api_name_raw": "top10_floatholders",
      "doc_id": 62,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司前十大流通股东数据。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "holder_name",
        "hold_num",
        "hold_ratio"
      ]
    },
    {
      "order": 51,
      "interface_name": "股权质押统计数据",
      "api_name": "stock_pledge_stat",
      "api_name_raw": "stock_pledge_stat",
      "doc_id": 110,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司股权质押统计汇总数据。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "pledge_num",
        "pledge_ratio",
        "total_shares",
        "circulation_shares"
      ]
    },
    {
      "order": 52,
      "interface_name": "股权质押明细数据",
      "api_name": "stock_pledge_detail",
      "api_name_raw": "stock_pledge_detail",
      "doc_id": 111,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司股权质押详细明细数据。",
      "params": [
        "ts_code",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "pledge_holder",
        "pledge_num",
        "pledge_date",
        "release_date"
      ]
    },
    {
      "order": 53,
      "interface_name": "股票回购",
      "api_name": "stock_repurchase",
      "api_name_raw": "stock_repurchase",
      "doc_id": 124,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司股票回购数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "ann_date",
        "repur_date",
        "end_date",
        "repur_amount",
        "repur_vol",
        "high_limit",
        "low_limit"
      ]
    },
    {
      "order": 54,
      "interface_name": "限售股解禁",
      "api_name": "stock_restricted",
      "api_name_raw": "stock_restricted",
      "doc_id": 160,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司限售股解禁数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "ann_date",
        "float_date",
        "float_share",
        "float_ratio",
        "type"
      ]
    },
    {
      "order": 55,
      "interface_name": "大宗交易",
      "api_name": "stock_block_trade",
      "api_name_raw": "stock_block_trade",
      "doc_id": 161,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司大宗交易数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "price",
        "vol",
        "amount",
        "buyer",
        "seller"
      ]
    },
    {
      "order": 56,
      "interface_name": "股东人数",
      "api_name": "stock_holdernum",
      "api_name_raw": "stock_holdernum",
      "doc_id": 166,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司股东人数数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "holder_num"
      ]
    },
    {
      "order": 57,
      "interface_name": "股东增减持",
      "api_name": "stock_holder_trade",
      "api_name_raw": "stock_holder_trade",
      "doc_id": 175,
      "category": "股票数据 → 参考数据",
      "description": "获取上市公司股东增减持数据。",
      "params": [
        "ts_code",
        "holder_type",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "holder_name",
        "holder_type",
        "change_type",
        "change_vol",
        "change_ratio",
        "after_share",
        "ann_date"
      ]
    },
    {
      "order": 58,
      "interface_name": "融资融券交易汇总",
      "api_name": "margin",
      "api_name_raw": "margin",
      "doc_id": 58,
      "category": "股票数据 → 两融及转融通",
      "description": "获取融资融券交易汇总数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "rzye",
        "rzmre",
        "rzche",
        "rqyl",
        "rqmcl",
        "rqchl"
      ]
    },
    {
      "order": 59,
      "interface_name": "融资融券交易明细",
      "api_name": "margin_detail",
      "api_name_raw": "margin_detail",
      "doc_id": 59,
      "category": "股票数据 → 两融及转融通",
      "description": "获取融资融券交易明细数据。",
      "params": [
        "trade_date",
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "rzye",
        "rzmre",
        "rzche",
        "rqyl",
        "rqmcl",
        "rqchl"
      ]
    },
    {
      "order": 60,
      "interface_name": "融资融券标的（盘前）",
      "api_name": "margin_target",
      "api_name_raw": "margin_target",
      "doc_id": 326,
      "category": "股票数据 → 两融及转融通",
      "description": "获取融资融券标的证券列表（盘前数据）。",
      "params": [
        "exchange",
        "target_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "exchange",
        "target_type",
        "target_status",
        "list_date",
        "remove_date"
      ]
    },
    {
      "order": 61,
      "interface_name": "转融资交易汇总",
      "api_name": "rzye_target",
      "api_name_raw": "rzye_target",
      "doc_id": 331,
      "category": "股票数据 → 两融及转融通",
      "description": "获取转融资交易汇总数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "rzye",
        "rzmre",
        "rzche"
      ]
    },
    {
      "order": 62,
      "interface_name": "券商盈利预测数据",
      "api_name": "fina_forecast",
      "api_name_raw": "fina_forecast",
      "doc_id": 292,
      "category": "股票数据 → 特色数据",
      "description": "获取券商对上市公司盈利预测数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "end_date",
        "org_type",
        "org_name",
        "eps",
        "net_profit",
        "revenue",
        "op_income"
      ]
    },
    {
      "order": 63,
      "interface_name": "每日筹码及胜率",
      "api_name": "stock_chip",
      "api_name_raw": "stock_chip",
      "doc_id": 293,
      "category": "股票数据 → 特色数据",
      "description": "获取每日筹码数据及胜率统计。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "chip_win_rate",
        "chip_avg_cost",
        "chip_20_80"
      ]
    },
    {
      "order": 64,
      "interface_name": "每日筹码分布",
      "api_name": "stock_shareholdernum",
      "api_name_raw": "stock_shareholdernum",
      "doc_id": 294,
      "category": "股票数据 → 特色数据",
      "description": "获取每日筹码分布数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "shareholder_num",
        "share_float",
        "share_ratio"
      ]
    },
    {
      "order": 65,
      "interface_name": "股票技术面因子（专业版）",
      "api_name": "stock_factor",
      "api_name_raw": "stock_factor",
      "doc_id": 328,
      "category": "股票数据 → 特色数据",
      "description": "获取股票技术面因子数据，包括各种技术指标。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "fields",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "ma5",
        "ma10",
        "ma20",
        "ma30",
        "ma60",
        "ema5",
        "ema10",
        "rsi",
        "kdj",
        "macd"
      ]
    },
    {
      "order": 66,
      "interface_name": "中央结算系统持股统计",
      "api_name": "stock_hold_stats",
      "api_name_raw": "stock_hold_stats",
      "doc_id": 295,
      "category": "股票数据 → 特色数据",
      "description": "获取中央结算系统持股统计数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "holder_num",
        "hold_share",
        "hold_ratio"
      ]
    },
    {
      "order": 67,
      "interface_name": "中央结算系统持股明细",
      "api_name": "stock_hold_detail",
      "api_name_raw": "stock_hold_detail",
      "doc_id": 274,
      "category": "股票数据 → 特色数据",
      "description": "获取中央结算系统持股明细数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "holder_name",
        "hold_share",
        "hold_ratio"
      ]
    },
    {
      "order": 68,
      "interface_name": "沪深股通持股明细",
      "api_name": "hsgt_hold_detail",
      "api_name_raw": "hsgt_hold_detail",
      "doc_id": 188,
      "category": "股票数据 → 特色数据",
      "description": "获取沪深股通持股明细数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "market",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "exchange",
        "holder_name",
        "hold_share",
        "hold_ratio",
        "change_ratio"
      ]
    },
    {
      "order": 69,
      "interface_name": "股票开盘集合竞价数据",
      "api_name": "stock_auction",
      "api_name_raw": "stock_auction",
      "doc_id": 353,
      "category": "股票数据 → 特色数据",
      "description": "获取股票开盘集合竞价阶段数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "time",
        "pre_close",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "amount",
        "match_vol"
      ]
    },
    {
      "order": 70,
      "interface_name": "股票收盘集合竞价数据",
      "api_name": "stock_auction_end",
      "api_name_raw": "stock_auction_end",
      "doc_id": 354,
      "category": "股票数据 → 特色数据",
      "description": "获取股票收盘集合竞价阶段数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "time",
        "pre_close",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "amount",
        "match_vol"
      ]
    },
    {
      "order": 71,
      "interface_name": "神奇九转指标",
      "api_name": "stock_magical",
      "api_name_raw": "stock_magical",
      "doc_id": 306,
      "category": "股票数据 → 特色数据",
      "description": "获取股票神奇九转技术指标数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "magical_turn",
        "signal",
        "level"
      ]
    },
    {
      "order": 72,
      "interface_name": "AH股比价",
      "api_name": "stock_ah_price",
      "api_name_raw": "stock_ah_price",
      "doc_id": 399,
      "category": "股票数据 → 特色数据",
      "description": "获取AH股比价数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "ah_price",
        "ah_ratio"
      ]
    },
    {
      "order": 73,
      "interface_name": "机构调研数据",
      "api_name": "stock_research",
      "api_name_raw": "stock_research",
      "doc_id": 275,
      "category": "股票数据 → 特色数据",
      "description": "获取机构调研上市公司数据。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "org_name",
        "org_type",
        "meet_type",
        "meet_date",
        "pub_date",
        "content"
      ]
    },
    {
      "order": 74,
      "interface_name": "券商月度金股",
      "api_name": "stock_gold",
      "api_name_raw": "stock_gold",
      "doc_id": 267,
      "category": "股票数据 → 特色数据",
      "description": "获取券商每月推荐的金股数据。",
      "params": [
        "month",
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "ts_code",
        "name",
        "org_name",
        "target_price",
        "reason"
      ]
    },
    {
      "order": 75,
      "interface_name": "个股资金流向",
      "api_name": "moneyflow",
      "api_name_raw": "moneyflow",
      "doc_id": 170,
      "category": "股票数据 → 资金流向数据",
      "description": "获取个股资金流向数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "net_inflow_main",
        "net_inflow_small",
        "net_inflow_medium",
        "net_inflow_large"
      ]
    },
    {
      "order": 76,
      "interface_name": "个股资金流向（THS）",
      "api_name": "moneyflow_ths",
      "api_name_raw": "moneyflow_ths",
      "doc_id": 348,
      "category": "股票数据 → 资金流向数据",
      "description": "获取同花顺版本的个股资金流向数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "net_inflow_main",
        "net_inflow_small",
        "net_inflow_medium",
        "net_inflow_large"
      ]
    },
    {
      "order": 77,
      "interface_name": "个股资金流向（DC）",
      "api_name": "moneyflow_dc",
      "api_name_raw": "moneyflow_dc",
      "doc_id": 349,
      "category": "股票数据 → 资金流向数据",
      "description": "获取东方财富版本的个股资金流向数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "net_inflow_main",
        "net_inflow_small",
        "net_inflow_medium",
        "net_inflow_large"
      ]
    },
    {
      "order": 78,
      "interface_name": "板块资金流向（THS）",
      "api_name": "moneyflow_industry_ths",
      "api_name_raw": "moneyflow_industry_ths",
      "doc_id": 371,
      "category": "股票数据 → 资金流向数据",
      "description": "获取同花顺版本的板块资金流向数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "industry_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "industry_code",
        "industry_name",
        "net_inflow_main",
        "net_inflow_small"
      ]
    },
    {
      "order": 79,
      "interface_name": "行业资金流向（THS）",
      "api_name": "moneyflow_hy_ths",
      "api_name_raw": "moneyflow_hy_ths",
      "doc_id": 343,
      "category": "股票数据 → 资金流向数据",
      "description": "获取同花顺版本的行业资金流向数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "industry_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "industry_code",
        "industry_name",
        "net_inflow"
      ]
    },
    {
      "order": 80,
      "interface_name": "板块资金流向（DC）",
      "api_name": "moneyflow_concept_dc",
      "api_name_raw": "moneyflow_concept_dc",
      "doc_id": 344,
      "category": "股票数据 → 资金流向数据",
      "description": "获取东方财富版本的板块资金流向数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "concept_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "concept_code",
        "concept_name",
        "net_inflow"
      ]
    },
    {
      "order": 81,
      "interface_name": "大盘资金流向（DC）",
      "api_name": "moneyflow_market_dc",
      "api_name_raw": "moneyflow_market_dc",
      "doc_id": 345,
      "category": "股票数据 → 资金流向数据",
      "description": "获取东方财富版本的大盘资金流向数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "net_inflow_main",
        "net_inflow_small",
        "net_inflow_medium",
        "net_inflow_large"
      ]
    },
    {
      "order": 82,
      "interface_name": "沪深港通资金流向",
      "api_name": "moneyflow_hsgt",
      "api_name_raw": "moneyflow_hsgt",
      "doc_id": 47,
      "category": "股票数据 → 资金流向数据",
      "description": "获取沪深港通资金流向数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "north_money",
        "south_money",
        "north_vol",
        "south_vol"
      ]
    },
    {
      "order": 83,
      "interface_name": "龙虎榜每日统计单",
      "api_name": "toplist",
      "api_name_raw": "toplist",
      "doc_id": 106,
      "category": "股票数据 → 打板专题数据",
      "description": "获取龙虎榜每日交易统计数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "close",
        "pct_chg",
        "turnover_rate",
        "amount",
        "buy",
        "sell",
        "net_buy"
      ]
    },
    {
      "order": 84,
      "interface_name": "龙虎榜机构交易单",
      "api_name": "top_inst",
      "api_name_raw": "top_inst",
      "doc_id": 107,
      "category": "股票数据 → 打板专题数据",
      "description": "获取龙虎榜机构买卖交易明细。",
      "params": [
        "trade_date",
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "exalter",
        "buy_vol",
        "sell_vol",
        "net_buy_vol"
      ]
    },
    {
      "order": 85,
      "interface_name": "同花顺涨跌停榜单",
      "api_name": "ths_daily",
      "api_name_raw": "ths_daily",
      "doc_id": 355,
      "category": "股票数据 → 打板专题数据",
      "description": "获取同花顺版本的涨跌停榜单数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "close",
        "pct_chg",
        "limit_type",
        "reason"
      ]
    },
    {
      "order": 86,
      "interface_name": "涨跌停和炸板数据",
      "api_name": "st_limit_list",
      "api_name_raw": "st_limit_list",
      "doc_id": 298,
      "category": "股票数据 → 打板专题数据",
      "description": "获取涨跌停和炸板数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "limit_type",
        "limit_price",
        "close_price",
        "open_price"
      ]
    },
    {
      "order": 87,
      "interface_name": "涨停股票连板天梯",
      "api_name": "limit_ladder",
      "api_name_raw": "limit_ladder",
      "doc_id": 356,
      "category": "股票数据 → 打板专题数据",
      "description": "获取涨停股票连板天数排行数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "limit_days",
        "close_price",
        "pct_chg"
      ]
    },
    {
      "order": 88,
      "interface_name": "涨停最强板块统计",
      "api_name": "limit_industry_stat",
      "api_name_raw": "limit_industry_stat",
      "doc_id": 357,
      "category": "股票数据 → 打板专题数据",
      "description": "获取涨停最强板块统计数据。",
      "params": [
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "industry_code",
        "industry_name",
        "stock_num",
        "limit_num",
        "limit_ratio"
      ]
    },
    {
      "order": 89,
      "interface_name": "同花顺行业概念板块",
      "api_name": "concept",
      "api_name_raw": "concept",
      "doc_id": 259,
      "category": "股票数据 → 打板专题数据",
      "description": "获取同花顺行业概念板块列表。",
      "params": [
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "src"
      ]
    },
    {
      "order": 90,
      "interface_name": "同花顺概念和行业指数行情",
      "api_name": "concept_daily",
      "api_name_raw": "concept_daily",
      "doc_id": 260,
      "category": "股票数据 → 打板专题数据",
      "description": "获取同花顺概念和行业指数行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 91,
      "interface_name": "同花顺行业概念成分",
      "api_name": "concept_detail",
      "api_name_raw": "concept_detail",
      "doc_id": 261,
      "category": "股票数据 → 打板专题数据",
      "description": "获取同花顺行业概念成分股。",
      "params": [
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "concept_code",
        "concept_name",
        "weight",
        "in_date",
        "out_date"
      ]
    },
    {
      "order": 92,
      "interface_name": "东方财富概念板块",
      "api_name": "concept_dc",
      "api_name_raw": "concept_dc",
      "doc_id": 362,
      "category": "股票数据 → 打板专题数据",
      "description": "获取东方财富概念板块列表。",
      "params": [
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "name",
        "src"
      ]
    },
    {
      "order": 93,
      "interface_name": "东方财富概念成分",
      "api_name": "concept_detail_dc",
      "api_name_raw": "concept_detail_dc",
      "doc_id": 363,
      "category": "股票数据 → 打板专题数据",
      "description": "获取东方财富概念成分股。",
      "params": [
        "ts_code",
        "concept_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "concept_code",
        "concept_name",
        "weight",
        "in_date",
        "out_date"
      ]
    },
    {
      "order": 94,
      "interface_name": "东财概念和行业指数行情",
      "api_name": "concept_daily_dc",
      "api_name_raw": "concept_daily_dc",
      "doc_id": 382,
      "category": "股票数据 → 打板专题数据",
      "description": "获取东方财富概念和行业指数行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 95,
      "interface_name": "开盘竞价成交（当日）",
      "api_name": "auction_trade",
      "api_name_raw": "auction_trade",
      "doc_id": 369,
      "category": "股票数据 → 打板专题数据",
      "description": "获取当日开盘竞价成交数据。",
      "params": [
        "trade_date",
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "price",
        "vol",
        "amount",
        "turnover_rate"
      ]
    },
    {
      "order": 96,
      "interface_name": "市场游资最全名录",
      "api_name": "money_capital",
      "api_name_raw": "money_capital",
      "doc_id": 311,
      "category": "股票数据 → 打板专题数据",
      "description": "获取市场游资（热钱）最全面名录数据。",
      "params": [
        "capital_type",
        "limit",
        "offset"
      ],
      "return_fields": [
        "capital_id",
        "capital_name",
        "capital_type",
        "market"
      ]
    },
    {
      "order": 97,
      "interface_name": "游资交易每日明细",
      "api_name": "money_trade",
      "api_name_raw": "money_trade",
      "doc_id": 312,
      "category": "股票数据 → 打板专题数据",
      "description": "获取游资每日交易明细数据。",
      "params": [
        "trade_date",
        "capital_id",
        "ts_code",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "capital_id",
        "capital_name",
        "buy_vol",
        "sell_vol",
        "net_vol"
      ]
    },
    {
      "order": 98,
      "interface_name": "同花顺App热榜数",
      "api_name": "ths_hot",
      "api_name_raw": "ths_hot",
      "doc_id": 320,
      "category": "股票数据 → 打板专题数据",
      "description": "获取同花顺App热榜数据。",
      "params": [
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "hot_index"
      ]
    },
    {
      "order": 99,
      "interface_name": "东方财富App热榜",
      "api_name": "dc_hot",
      "api_name_raw": "dc_hot",
      "doc_id": 321,
      "category": "股票数据 → 打板专题数据",
      "description": "获取东方财富App热榜数据。",
      "params": [
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "hot_index"
      ]
    },
    {
      "order": 100,
      "interface_name": "通达信板块信息",
      "api_name": "tdx_block_info",
      "api_name_raw": "tdx_block_info",
      "doc_id": 376,
      "category": "股票数据 → 打板专题数据",
      "description": "获取通达信板块信息。",
      "params": [
        "ts_code",
        "block_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "block_code",
        "block_name",
        "ts_code",
        "src"
      ]
    },
    {
      "order": 101,
      "interface_name": "通达信板块成分",
      "api_name": "tdx_block_detail",
      "api_name_raw": "tdx_block_detail",
      "doc_id": 377,
      "category": "股票数据 → 打板专题数据",
      "description": "获取通达信板块成分股。",
      "params": [
        "block_code",
        "ts_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "block_code",
        "block_name",
        "ts_code",
        "weight"
      ]
    },
    {
      "order": 102,
      "interface_name": "通达信板块行情",
      "api_name": "tdx_block_daily",
      "api_name_raw": "tdx_block_daily",
      "doc_id": 378,
      "category": "股票数据 → 打板专题数据",
      "description": "获取通达信板块行情数据。",
      "params": [
        "ts_code",
        "trade_date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "vol",
        "amount"
      ]
    },
    {
      "order": 103,
      "interface_name": "榜单数据（开盘啦）",
      "api_name": "kpl_toplist",
      "api_name_raw": "kpl_toplist",
      "doc_id": 347,
      "category": "股票数据 → 打板专题数据",
      "description": "获取开盘啦平台的榜单数据。",
      "params": [
        "trade_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "trade_date",
        "ts_code",
        "name",
        "buy_amount",
        "sell_amount",
        "net_amount"
      ]
    },
    {
      "order": 104,
      "interface_name": "题材成分（开盘啦）",
      "api_name": "kpl_concept",
      "api_name_raw": "kpl_concept",
      "doc_id": 351,
      "category": "股票数据 → 打板专题数据",
      "description": "获取开盘啦平台的题材成分股。",
      "params": [
        "ts_code",
        "concept_code",
        "limit",
        "offset"
      ],
      "return_fields": [
        "ts_code",
        "concept_code",
        "concept_name",
        "weight"
      ]
    },
    {
      "order": 105,
      "interface_name": "国内生产总值（GDP）",
      "api_name": "gdp",
      "api_name_raw": "gdp",
      "doc_id": 227,
      "category": "宏观经济 → 国内宏观 → 国民经济",
      "description": "获取中国国内生产总值数据。",
      "params": [
        "quarter",
        "limit",
        "offset"
      ],
      "return_fields": [
        "quarter",
        "gdp",
        "gdp_yoy",
        "pi",
        "pi_yoy",
        "ci",
        "ci_yoy"
      ]
    },
    {
      "order": 106,
      "interface_name": "居民消费价格指数（CPI）",
      "api_name": "cpi",
      "api_name_raw": "cpi",
      "doc_id": 228,
      "category": "宏观经济 → 国内宏观 → 价格指数",
      "description": "获取中国居民消费价格指数月度数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "cpi",
        "cpi_yoy",
        "cpi_month"
      ]
    },
    {
      "order": 107,
      "interface_name": "工业生产者出厂价格指数（PPI）",
      "api_name": "ppi",
      "api_name_raw": "ppi",
      "doc_id": 245,
      "category": "宏观经济 → 国内宏观 → 价格指数",
      "description": "获取工业生产者出厂价格指数月度数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "ppi",
        "ppi_yoy",
        "ppi_month"
      ]
    },
    {
      "order": 108,
      "interface_name": "货币供应量（月度）",
      "api_name": "money_supply",
      "api_name_raw": "money_supply",
      "doc_id": 242,
      "category": "宏观经济 → 国内宏观 → 金融",
      "description": "获取货币供应量月度数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "m0",
        "m0_yoy",
        "m1",
        "m1_yoy",
        "m2",
        "m2_yoy"
      ]
    },
    {
      "order": 109,
      "interface_name": "社会融资增量（月度）",
      "api_name": "financing",
      "api_name_raw": "financing",
      "doc_id": 310,
      "category": "宏观经济 → 国内宏观 → 金融",
      "description": "获取社会融资增量月度数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "financing",
        "financing_yoy"
      ]
    },
    {
      "order": 110,
      "interface_name": "Shibor利率",
      "api_name": "shibor",
      "api_name_raw": "shibor",
      "doc_id": 149,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取上海银行间同业拆放利率数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "on_1w",
        "on_2w",
        "on_1m",
        "on_3m",
        "on_6m",
        "on_9m",
        "on_1y"
      ]
    },
    {
      "order": 111,
      "interface_name": "Shibor报价数据",
      "api_name": "shibor_detail",
      "api_name_raw": "shibor_detail",
      "doc_id": 150,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取Shibor报价详细数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "bank",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "bank",
        "on_1w",
        "on_2w",
        "on_1m",
        "on_3m",
        "on_6m",
        "on_9m",
        "on_1y"
      ]
    },
    {
      "order": 112,
      "interface_name": "LPR贷款基础利率",
      "api_name": "lpr",
      "api_name_raw": "lpr",
      "doc_id": 151,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取贷款市场报价利率（LPR）数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "lpr_1y",
        "lpr_1y_avg",
        "lpr_5y",
        "lpr_5y_avg"
      ]
    },
    {
      "order": 113,
      "interface_name": "Libor利率",
      "api_name": "libor",
      "api_name_raw": "libor",
      "doc_id": 152,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取伦敦银行同业拆借利率（Libor）数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "usd_1w",
        "usd_2w",
        "usd_1m",
        "usd_3m",
        "usd_6m",
        "usd_12m"
      ]
    },
    {
      "order": 114,
      "interface_name": "Hibor利率",
      "api_name": "hibor",
      "api_name_raw": "hibor",
      "doc_id": 153,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取香港银行同业拆借利率（Hibor）数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "hibor_1w",
        "hibor_2w",
        "hibor_1m",
        "hibor_3m",
        "hibor_6m",
        "hibor_12m"
      ]
    },
    {
      "order": 115,
      "interface_name": "温州民间借贷利率",
      "api_name": "wz_rate",
      "api_name_raw": "wz_rate",
      "doc_id": 173,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取温州民间借贷利率数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "rate"
      ]
    },
    {
      "order": 116,
      "interface_name": "广州民间借贷利率",
      "api_name": "gz_rate",
      "api_name_raw": "gz_rate",
      "doc_id": 174,
      "category": "宏观经济 → 国内宏观 → 利率数据",
      "description": "获取广州民间借贷利率数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "rate"
      ]
    },
    {
      "order": 117,
      "interface_name": "采购经理指数（PMI）",
      "api_name": "pmi",
      "api_name_raw": "pmi",
      "doc_id": 325,
      "category": "宏观经济 → 国内宏观 → 景气度",
      "description": "获取中国采购经理指数（PMI）数据。",
      "params": [
        "month",
        "limit",
        "offset"
      ],
      "return_fields": [
        "month",
        "pmi",
        "pmi_yoy"
      ]
    },
    {
      "order": 118,
      "interface_name": "国债收益率曲线利率",
      "api_name": "bond_china_yield",
      "api_name_raw": "bond_china_yield",
      "doc_id": 218,
      "category": "宏观经济 → 国际宏观 → 美国利率",
      "description": "获取中国国债收益率曲线利率数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "type",
        "rate"
      ]
    },
    {
      "order": 119,
      "interface_name": "短期国债利率",
      "api_name": "bond_treasury_short",
      "api_name_raw": "bond_treasury_short",
      "doc_id": 220,
      "category": "宏观经济 → 国际宏观 → 美国利率",
      "description": "获取美国短期国债利率数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "m1",
        "m3",
        "m6",
        "y1"
      ]
    },
    {
      "order": 120,
      "interface_name": "国债长期利率",
      "api_name": "bond_treasury_long",
      "api_name_raw": "bond_treasury_long",
      "doc_id": 221,
      "category": "宏观经济 → 国际宏观 → 美国利率",
      "description": "获取美国长期国债利率数据。",
      "params": [
        "date",
        "start_date",
        "end_date",
        "limit",
        "offset"
      ],
      "return_fields": [
        "date",
        "y3",
        "y5",
        "y7",
        "y10",
        "y20",
        "y30"
      ]
    }
  ]
}
```
<!-- TUSHARE_11000_STRUCTURED_JSON_END -->
