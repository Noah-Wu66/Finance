# Gemini 3.1 Pro API 完整调用指南

> **模型版本**：`gemini-3.1-pro-preview`（2026 年 2 月 19 日发布）  
> **知识截止日期**：2025 年 1 月（超出范围请使用联网检索）  
> **上下文窗口**：输入最大 1,048,576 tokens；输出最大 65,536 tokens

---

## 一、模型概述

Gemini 3.1 Pro 是 Google 目前最先进的推理模型，相比前代 Gemini 3 Pro 有以下核心改进：

| 改进项 | 说明 |
|---|---|
| **更强的推理能力** | 新增 `medium` 思考级别，提供低/中/高三档灵活调节 |
| **更高的 Token 效率** | 在相同任务下消耗更少的思考 token |
| **软件工程能力提升** | 对代码生成、调试、多步骤 Agent 任务有显著提升 |
| **自定义工具端点** | 提供 `gemini-3.1-pro-preview-customtools` 端点，更好地支持自定义工具 |

---

## 二、环境准备

### 安装 SDK

```bash
pip install google-generativeai
```

> 推荐使用 `google-genai` 新版 SDK（`from google import genai`），功能更完整，本文两种写法均有示例。

### 配置 API 密钥

```bash
# 方法一：设置环境变量（推荐）
export GOOGLE_API_KEY="YOUR_API_KEY"

# 方法二：在代码中直接配置
import google.generativeai as genai
genai.configure(api_key="YOUR_API_KEY")
```

---

## 三、基础调用

最简单的文本生成调用，使用新版 `google-genai` SDK：

```python
from google import genai

# SDK 会自动读取 GOOGLE_API_KEY 环境变量
client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="请解释量子纠缠的基本原理。",
)

print(response.text)
```

使用旧版 `google-generativeai` SDK（兼容写法）：

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-3.1-pro-preview")

response = model.generate_content("请解释量子纠缠的基本原理。")
print(response.text)
```

---

## 四、思考深度调节（Thinking Level）

Gemini 3.1 Pro 引入了 `thinking_level` 参数来控制模型的推理深度。这是 Gemini 3 系列的**新推荐参数**，替代了旧版的 `thinking_budget`。

> **重要提示**：`thinking_level` 与 `thinking_budget` 不可同时使用，否则会返回 400 错误。

### 各级别对比

| 思考级别 | Gemini 3.1 Pro 支持 | 适用场景 | 特点 |
|---|---|---|---|
| `low` | ✅ | 简单问答、聊天、高并发 | 延迟最低、成本最低 |
| `medium` | ✅（3.1 Pro 新增）| 大多数通用任务 | 性能与成本的最佳平衡 |
| `high` | ✅（**默认值**，动态）| 复杂推理、数学、代码 | 推理最深入，延迟最高 |

### 代码示例

```python
from google import genai
from google.genai import types

client = genai.Client()

# --- 低思考深度（快速响应）---
response_low = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="今天天气怎么样？",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="low")
    ),
)

# --- 中等思考深度（均衡）---
response_medium = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="请分析一下电动汽车行业的未来发展趋势。",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="medium")
    ),
)

# --- 高思考深度（默认，最强推理）---
response_high = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="证明黎曼猜想与素数分布之间的关系。",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high")
    ),
)

print(response_low.text)
print(response_medium.text)
print(response_high.text)
```

### 查看思考过程摘要

通过设置 `include_thoughts=True`，可以获取模型的内部思考摘要：

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="前 50 个素数的总和是多少？",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level="high",
            include_thoughts=True  # 启用思考过程摘要
        )
    ),
)

for part in response.candidates[0].content.parts:
    if not part.text:
        continue
    if part.thought:
        print("【思考过程】:")
        print(part.text)
    else:
        print("【最终答案】:")
        print(part.text)
```

---

## 五、最大输出控制（Max Output Tokens）

Gemini 3.1 Pro 的最大输出为 **65,536 tokens**。通过 `max_output_tokens` 参数可以限制输出长度，以控制成本和响应速度。

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="请写一篇关于人工智能发展历史的长文。",
    config=types.GenerateContentConfig(
        max_output_tokens=1024,    # 限制最大输出为 1024 tokens
        temperature=1.0,           # 官方强烈建议保持默认值 1.0，勿随意修改
    ),
)

print(response.text)

# 查看实际使用的 token 数量
print(f"\n--- Token 使用情况 ---")
print(f"输入 tokens: {response.usage_metadata.prompt_token_count}")
print(f"输出 tokens: {response.usage_metadata.candidates_token_count}")
print(f"思考 tokens: {response.usage_metadata.thoughts_token_count}")
print(f"总计 tokens: {response.usage_metadata.total_token_count}")
```

> **关于 Temperature**：官方文档明确指出，Gemini 3 系列模型的推理能力已针对默认值 `1.0` 进行优化。将其设置为低于 `1.0` 可能导致循环或性能下降，**强烈建议不要修改此参数**。

---

## 六、联网检索（Google Search Grounding）

通过启用 `google_search` 工具，模型可以实时检索 Google 搜索结果，从而突破 2025 年 1 月的知识截止日期，获取最新信息。

### 基础联网检索

```python
from google import genai
from google.genai import types

client = genai.Client()

# 定义 Google 搜索工具
grounding_tool = types.Tool(
    google_search=types.GoogleSearch()
)

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="2026年最新的大语言模型排行榜是什么？",
    config=types.GenerateContentConfig(
        tools=[grounding_tool]
    ),
)

print(response.text)
```

### 解析引用来源

联网检索的响应中包含 `grounding_metadata`，可以提取搜索来源并生成带引用的回答：

```python
from google import genai
from google.genai import types

client = genai.Client()

grounding_tool = types.Tool(
    google_search=types.GoogleSearch()
)

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="请介绍一下最近发布的 Gemini 3.1 Pro 模型的主要特点。",
    config=types.GenerateContentConfig(
        tools=[grounding_tool]
    ),
)

print("【模型回答】:")
print(response.text)

# 提取引用来源
candidate = response.candidates[0]
if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
    metadata = candidate.grounding_metadata
    
    print("\n【搜索查询词】:")
    for query in metadata.web_search_queries:
        print(f"  - {query}")
    
    print("\n【引用来源】:")
    for i, chunk in enumerate(metadata.grounding_chunks):
        if chunk.web:
            print(f"  [{i+1}] {chunk.web.title}: {chunk.web.uri}")
```

### 带内联引用的完整实现

```python
def add_inline_citations(response) -> str:
    """
    将模型回答与来源引用合并，生成带内联引用的 Markdown 格式文本。
    """
    text = response.text
    candidate = response.candidates[0]
    
    if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
        return text
    
    supports = candidate.grounding_metadata.grounding_supports
    chunks = candidate.grounding_metadata.grounding_chunks
    
    # 按 end_index 倒序排列，避免插入引用时偏移量错乱
    sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)
    
    for support in sorted_supports:
        end_index = support.segment.end_index
        if support.grounding_chunk_indices:
            citation_links = []
            for i in support.grounding_chunk_indices:
                if i < len(chunks) and chunks[i].web:
                    uri = chunks[i].web.uri
                    citation_links.append(f"[[{i+1}]]({uri})")
            citation_string = " ".join(citation_links)
            text = text[:end_index] + " " + citation_string + text[end_index:]
    
    return text
```

---

## 七、综合完整示例

以下代码将所有功能整合在一起，展示了一个生产级别的调用封装：

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Gemini 3.1 Pro API 生产级调用封装
模型 ID: gemini-3.1-pro-preview
发布日期: 2026-02-19
"""

import os
from google import genai
from google.genai import types


def call_gemini_3_1_pro(
    prompt: str,
    thinking_level: str = "high",
    max_output_tokens: int = 8192,
    enable_search: bool = False,
    include_thoughts: bool = False,
    system_instruction: str = None,
) -> dict:
    """
    Gemini 3.1 Pro 统一调用接口。

    参数:
        prompt          (str)  : 用户输入的提示文本。
        thinking_level  (str)  : 思考深度，可选 'low' | 'medium' | 'high'（默认 'high'）。
        max_output_tokens (int): 最大输出 token 数，范围 1~65536（默认 8192）。
        enable_search   (bool) : 是否启用 Google 联网检索（默认 False）。
        include_thoughts (bool): 是否在响应中包含思考过程摘要（默认 False）。
        system_instruction (str): 系统级指令，用于设定模型角色和行为（可选）。

    返回:
        dict: 包含 'answer'（回答文本）、'thoughts'（思考摘要，可选）、
              'sources'（引用来源列表，联网时可用）、'usage'（token 用量）的字典。
    """
    # 初始化客户端（自动读取 GOOGLE_API_KEY 环境变量）
    client = genai.Client()

    # 构建工具列表
    tools = []
    if enable_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))

    # 构建生成配置
    thinking_config = types.ThinkingConfig(
        thinking_level=thinking_level,
        include_thoughts=include_thoughts,
    )
    generation_config = types.GenerateContentConfig(
        thinking_config=thinking_config,
        max_output_tokens=max_output_tokens,
        temperature=1.0,  # 官方建议：Gemini 3 系列请保持默认值 1.0
        tools=tools if tools else None,
        system_instruction=system_instruction,
    )

    # 发起 API 调用
    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=prompt,
        config=generation_config,
    )

    # 解析响应
    answer = ""
    thoughts = ""
    for part in response.candidates[0].content.parts:
        if not part.text:
            continue
        if part.thought:
            thoughts += part.text
        else:
            answer += part.text

    # 提取引用来源（仅联网检索时有效）
    sources = []
    candidate = response.candidates[0]
    if enable_search and hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
        for chunk in candidate.grounding_metadata.grounding_chunks:
            if chunk.web:
                sources.append({
                    "title": chunk.web.title,
                    "uri": chunk.web.uri,
                })

    # 整理 Token 用量
    usage = {
        "prompt_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count,
        "thinking_tokens": getattr(response.usage_metadata, 'thoughts_token_count', 0),
        "total_tokens": response.usage_metadata.total_token_count,
    }

    return {
        "answer": answer,
        "thoughts": thoughts if include_thoughts else None,
        "sources": sources,
        "usage": usage,
    }


# ============================================================
# 使用示例
# ============================================================
if __name__ == "__main__":

    # 示例 1：基础调用（默认高思考深度）
    print("=" * 60)
    print("示例 1：基础调用")
    result = call_gemini_3_1_pro(
        prompt="请用简洁的语言解释什么是 Transformer 架构。",
    )
    print(f"回答：{result['answer']}")
    print(f"Token 用量：{result['usage']}")

    # 示例 2：低思考深度 + 限制输出（适合高并发场景）
    print("\n" + "=" * 60)
    print("示例 2：低思考深度 + 限制输出")
    result = call_gemini_3_1_pro(
        prompt="用一句话总结机器学习的定义。",
        thinking_level="low",
        max_output_tokens=100,
    )
    print(f"回答：{result['answer']}")
    print(f"Token 用量：{result['usage']}")

    # 示例 3：联网检索 + 中等思考深度
    print("\n" + "=" * 60)
    print("示例 3：联网检索 + 中等思考深度")
    result = call_gemini_3_1_pro(
        prompt="截至 2026 年 3 月，最新发布的主流大语言模型有哪些？",
        thinking_level="medium",
        enable_search=True,
        max_output_tokens=2048,
    )
    print(f"回答：{result['answer']}")
    if result['sources']:
        print("\n引用来源：")
        for i, src in enumerate(result['sources'], 1):
            print(f"  [{i}] {src['title']} - {src['uri']}")
    print(f"Token 用量：{result['usage']}")

    # 示例 4：高思考深度 + 查看思考过程 + 系统指令
    print("\n" + "=" * 60)
    print("示例 4：高思考深度 + 思考过程可视化")
    result = call_gemini_3_1_pro(
        prompt="一个正整数 n，如果它等于其所有真因子之和，则称为完全数。请找出前 3 个完全数并证明。",
        thinking_level="high",
        include_thoughts=True,
        system_instruction="你是一位严谨的数学教授，请用专业且清晰的语言回答问题。",
    )
    if result['thoughts']:
        print(f"思考过程摘要：\n{result['thoughts'][:500]}...\n")
    print(f"最终回答：{result['answer']}")
    print(f"Token 用量：{result['usage']}")
```

---

## 八、关键参数速查表

| 参数 | 类型 | 说明 | 默认值 | 推荐值 |
|---|---|---|---|---|
| `model` | `str` | 模型 ID | — | `"gemini-3.1-pro-preview"` |
| `thinking_level` | `str` | 思考深度 | `"high"`（动态） | 按需选择 |
| `max_output_tokens` | `int` | 最大输出 token 数 | 65,536 | 按需限制 |
| `temperature` | `float` | 随机性控制 | `1.0` | **保持 `1.0`，勿修改** |
| `tools` | `list` | 工具列表（如搜索） | `None` | 按需启用 |
| `include_thoughts` | `bool` | 是否返回思考摘要 | `False` | 调试时开启 |
| `system_instruction` | `str` | 系统级角色指令 | `None` | 按需设定 |

---

## 九、注意事项

**关于 `thinking_level` 与 `thinking_budget`**：两者不可同时使用。Gemini 3 系列推荐使用 `thinking_level`；旧版 `thinking_budget` 仍向后兼容，但官方不再推荐。

**关于 Temperature**：Gemini 3 系列的推理能力针对 `temperature=1.0` 进行了专项优化。将其调低（如 `0.2`）可能导致模型陷入循环或推理质量下降，官方**强烈建议保持默认值**。

**关于联网检索计费**：使用 Gemini 3 系列时，每次模型执行的搜索查询均单独计费。若模型在一次请求中执行了多条搜索，则按实际查询次数计费。

**关于 Thought Signatures**：在多轮对话或函数调用场景中，模型会在响应中附带加密的 Thought Signatures。官方 SDK 会自动处理这些签名，无需手动管理；若使用 REST API，则必须在后续请求中原样返回这些签名，否则会触发 400 错误。

---

## 十、参考资料

- [Gemini 3.1 Pro Preview 官方文档](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview)
- [Gemini 3 开发者指南](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini Thinking 文档](https://ai.google.dev/gemini-api/docs/thinking)
- [Grounding with Google Search 文档](https://ai.google.dev/gemini-api/docs/google-search)
- [Vertex AI - Gemini 3.1 Pro 规格](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro)
- [Gemini API 定价](https://ai.google.dev/gemini-api/docs/pricing)
