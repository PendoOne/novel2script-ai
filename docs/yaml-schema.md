# 剧本 YAML Schema 规范文档

> 版本：1.0  
> 适用场景：AI 小说转剧本工具输出格式  
> 格式：YAML 1.2

---

## 目录

1. [概述与设计哲学](#1-概述与设计哲学)
2. [完整 Schema 定义](#2-完整-schema-定义)
3. [字段设计原因](#3-字段设计原因)
4. [完整示例](#4-完整示例)
5. [扩展与自定义](#5-扩展与自定义)

---

## 1. 概述与设计哲学

### 1.1 为什么选择 YAML？

| 对比维度 | YAML | JSON | XML | Markdown |
|---------|------|------|-----|----------|
| 人类可读性 | ★★★★★ | ★★★ | ★★ | ★★★★ |
| 结构表达能力 | ★★★★★ | ★★★★ | ★★★★★ | ★★ |
| 编剧工具兼容 | ★★★★ | ★★★ | ★★ | ★ |
| 版本控制友好 | ★★★★★ | ★★★★★ | ★★★★ | ★★★ |
| AI 生成准确性 | ★★★★ | ★★★★★ | ★★★ | ★★ |

**选择 YAML 的核心理由：**

1. **编剧友好**：剧本创作者通常来自非技术背景，YAML 的缩进层级和 `key: value` 结构远比 JSON 的 `{}[]` 直观，接近自然阅读习惯。
2. **结构化与可读性的平衡点**：Markdown 太自由（缺乏约束），JSON 太严格（阅读负担重），XML 太冗长。YAML 在"人能轻松读"和"机器能准确解析"之间取得了最佳平衡。
3. **层级映射自然**：剧本天然是层级结构（剧本 → 幕 → 场景 → 节拍 → 对话），YAML 的缩进嵌套完美映射这一结构。
4. **注释支持**：YAML 原生支持 `#` 注释，编剧可以在任何位置添加批注，这是 JSON 不具备的关键能力。
5. **行业趋势**：Final Draft、Fountain 等剧本格式正在向结构化数据靠拢，YAML 作为中间格式具有最佳互操作性。

### 1.2 设计原则

本 Schema 遵循以下核心原则：

- **渐进式复杂度（Progressive Complexity）**：必填字段极少，编剧可以从最简单的骨架开始，逐步丰富细节。AI 生成时也遵循此原则——先生成主干，再补充枝叶。
- **语义化命名（Semantic Naming）**：字段名直接反映剧本行业术语（如 `beat`、`parenthetical`、`logline`），降低学习成本。
- **分离关注点（Separation of Concerns）**：元数据、角色、结构、场景内容各自独立，修改角色设定不会影响场景内容，反之亦然。
- **AI 友好（AI-Friendly）**：每个字段都有明确的类型约束和描述，使 AI 模型能准确理解预期输出格式，减少幻觉（hallucination）。
- **可扩展性（Extensibility）**：通过 `tags`、`notes`、`metadata` 等自由字段，支持不同项目类型的定制需求。

---

## 2. 完整 Schema 定义

### 2.1 顶层结构

```yaml
# 剧本根节点
script:
  meta:        # 元数据（必填）
  characters:  # 角色列表（可选，AI 自动提取时生成）
  structure:   # 叙事结构（可选，定义幕/集结构）
  scenes:      # 场景列表（必填，核心内容）
```

### 2.2 `meta` — 元数据

```yaml
meta:
  # === 必填字段 ===
  title: string              # 剧本标题
  format: enum               # 剧本格式：film | tv_series | stage_play | web_series | animation

  # === 推荐字段 ===
  original_novel: string     # 原著小说名称
  original_author: string    # 原著作者
  script_author: string      # 剧本改编者
  version: string            # 版本号，如 "1.0"、"draft-2"
  created_date: string       # 创建日期，ISO 8601 格式 (YYYY-MM-DD)
  modified_date: string      # 最后修改日期

  # === 可选字段 ===
  genre: [string]            # 类型标签列表，如 ["悬疑", "爱情", "历史"]
  subgenre: [string]         # 子类型
  logline: string            # 一句话梗概（好莱坞标准：25-35字）
  synopsis: string           # 故事梗概（100-300字）
  episode:                   # 仅 tv_series / web_series 格式使用
    season: int              #   第几季
    episode_number: int      #   第几集
    episode_title: string    #   分集标题
  target_audience: string    # 目标受众
  word_count: int            # 预估总字数
  scene_count: int           # 场景总数
  language: string           # 语言，默认 "zh-CN"
  notes: string              # 编剧备注
  tags: [string]             # 自定义标签
  metadata: map              # 扩展元数据（任意键值对）
```

### 2.3 `characters` — 角色列表

```yaml
characters:
  - id: string               # 唯一标识符，推荐用英文名或拼音，如 "linghu_chong"
    name: string             # 角色中文名
    role: enum               # 角色定位：protagonist | antagonist | supporting | minor | cameo
    age: string              # 年龄（可以是范围或模糊描述，如 "25"、"30-35"、"中年"）
    gender: string           # 性别
    occupation: string       # 职业/身份
    description: string      # 外貌与气质描述（50-100字）
    personality: [string]    # 性格特征标签，如 ["勇敢", "冲动", "重情义"]
    motivation: string       # 核心动机/欲望（角色弧线的驱动力）
    arc: string              # 角色弧线描述（角色在故事中的变化轨迹）
    backstory: string        # 背景故事摘要
    relationships:           # 与其他角色的关系
      - target: string       #   关联角色 ID
        type: string         #   关系类型，如 "爱人"、"仇敌"、"师徒"
        description: string  #   关系描述
    notes: string            # 备注
```

### 2.4 `structure` — 叙事结构

```yaml
structure:
  model: enum                # 结构模型：three_act | five_act | episodic | hero_journey | custom
  act_count: int             # 幕数
  acts:
    - act_number: int        #   幕编号（从1开始）
      title: string          #   幕标题，如 "建置"、"对抗"、"解决"
      summary: string        #   幕内容摘要
      scene_range: [int, int] #   该幕包含的场景编号范围，如 [1, 15]
      turning_point: string  #   关键转折点描述
  episodes:                  # 仅 episodic 模式
    - episode_number: int
      title: string
      scene_range: [int, int]
```

### 2.5 `scenes` — 场景列表（核心）

这是剧本的核心部分。每个场景是一个独立的叙事单元。

```yaml
scenes:
  - scene_number: int        # 场景编号（从1开始，全局唯一）
    act: int                 # 所属幕编号
    chapter_ref: int         # 对应原著章节编号（可追溯来源）

    # --- 场景头（Slug Line）---
    location:
      name: string           #   场景地点名称，如 "令狐冲的茅草屋"
      type: enum             #   地点类型：INT（内景）| EXT（外景）| INT/EXT（内外结合）
      description: string    #   场景环境描述
      props: [string]        #   关键道具

    time: string             # 时间描述，如 "深夜"、"清晨"、"三年前"、"公元1644年春"
    time_of_day: enum        # 标准化时段：dawn | morning | noon | afternoon | evening | night | midnight | unknown

    # --- 场景概览 ---
    summary: string          # 场景内容一句话概括
    mood: string             # 场景氛围/情绪基调
    characters_present:      # 本场景出场角色
      - id: string           #   角色 ID（引用 characters 列表中的 id）
        status: enum         #   出场状态：present | mentioned | voice_only | flashback
    duration_estimate: string # 预估时长，如 "3min"、"5页"

    # --- 场景内容：节拍列表 ---
    beats:
      # 类型一：动作/描述
      - type: action         #   节拍类型
        description: string  #   动作或场景描述
        characters: [string] #   参与角色 ID 列表
        camera: string       #   （可选）镜头建议

      # 类型二：对话
      - type: dialogue       #   节拍类型
        character: string    #   说话角色 ID
        delivery: enum       #   对话方式：normal | voiceover | off_screen | internal | telepathic | narration
        emotion: string      #   情绪状态，如 "愤怒"、"平静"、"讽刺"
        text: string         #   对话内容（核心）
        parenthetical: string #  括号动作指示（表演提示），如 "低声"、"停顿片刻"
        target: string       #   对话目标角色 ID
        subtext: string      #   潜台词（角色真正想表达但未说出口的）

      # 类型三：转场
      - type: transition     #   节拍类型
        value: enum          #   转场类型：CUT TO | FADE IN | FADE OUT | DISSOLVE TO | SMASH CUT TO | MATCH CUT TO

    # --- 场景元数据 ---
    conflict_level: enum     # 冲突强度：low | medium | high | climax
    emotional_shift: string  # 情绪变化描述（从 X 到 Y）
    key_dialogue: string     # 本场景关键台词/金句
    notes: string            # 编剧场景备注
    tags: [string]           # 自定义标签
```

---

## 3. 字段设计原因

### 3.1 为什么用 `beats` 而非传统的"描述 + 对话分离"？

传统剧本格式（如好莱坞标准格式）将"动作描述"和"对话块"严格分离。但这带来了一个问题：**顺序信息的丢失**。实际剧本中，动作和对话是交替进行的：

```
小明推开门（动作）
小明："你来了。"（对话）
他缓缓走向桌前（动作）
小红："我等了很久。"（对话）
```

如果使用分离结构：
```yaml
# 不推荐
actions:
  - "小明推开门"
  - "他缓缓走向桌前"
dialogues:
  - character: "小明", text: "你来了。"
  - character: "小红", text: "我等了很久。"
```

读者（和 AI）**无法从数据结构中得知**"他缓缓走向桌前"这个动作发生在两句对话之间。而 `beats` 列表保留了原始的时间顺序，每个节拍按实际发生顺序排列，完整还原叙事流。

### 3.2 为什么同时有 `time` 和 `time_of_day`？

- `time`：**人类可读的自由文本**，保留编剧的创作意图和文学性（"那个雨一直下的黄昏"）。
- `time_of_day`：**机器可解析的枚举值**，用于自动化场景排序、时长计算、拍摄计划生成。

两者互补，不互相替代。AI 生成时，`time_of_day` 可以自动从 `time` 文本中推断。

### 3.3 为什么角色使用 `id` 引用而非直接嵌入？

```yaml
# 推荐：引用式
characters_present:
  - id: "linghu_chong"
    status: present

# 不推荐：嵌入式（数据冗余）
characters_present:
  - name: "令狐冲"
    age: "25"
    description: "..."
```

**设计理由：**

1. **单一数据源（Single Source of Truth）**：角色信息在 `characters` 列表中统一定义。修改角色描述时，不需要遍历所有场景。
2. **AI 生成效率**：AI 只需要在对话节拍中输出角色 ID，而非每次重复完整描述，大幅减少 token 消耗。
3. **防止不一致**：嵌入式容易导致同一角色在不同场景中出现矛盾的描述信息。

### 3.4 为什么对话有 `subtext`（潜台词）字段？

这是本 Schema 区别于传统剧本格式的关键创新之一。

在剧本创作中，"角色说了什么"和"角色真正想表达什么"常常不同。例如：

```
角色A："你走吧。"（text）
潜台词："别走，求你了。"（subtext）
```

显式标注潜台词的好处：
- **指导演员表演**：演员需要知道表面台词之下的真实情感。
- **提升 AI 改编质量**：AI 在分析小说时会推断角色的潜台词，显式记录这一推断结果，方便编剧审核和修正。
- **增强剧本深度**：好的剧本往往胜在潜台词。将其结构化意味着编辑工具可以统计、分析全剧的潜台词分布。

### 3.5 为什么有 `chapter_ref` 字段？

这是"小说转剧本"特化设计。`chapter_ref` 记录了每个剧本场景对应的原著章节：

```yaml
scenes:
  - scene_number: 5
    chapter_ref: 3  # 该场景改编自原著第3章
```

价值：
- **溯源（Traceability）**：编剧可以随时回溯原著对应位置，检查改编是否遗漏重要情节。
- **改编覆盖度分析**：工具可以自动统计"第3章的内容被改编成了场景5-8"，帮助作者评估改编完整性。
- **版本对比**：当原著修改后，可以快速定位受影响的剧本场景。

### 3.6 为什么 `conflict_level` 和 `emotional_shift` 是场景级别字段？

这两个字段服务于**剧本节奏分析**：

- `conflict_level`：串联所有场景后，可以得到冲突强度曲线，判断剧本是否有"过山车式"的张力变化，还是平淡无奇。
- `emotional_shift`：记录场景内的情绪变化（如"从紧张到释然"），帮助编剧确保每个场景都在推动角色或情节发生变化。

**静态的剧本是文字，动态的剧本是节奏。** 这两个字段是连接两者的桥梁。

### 3.7 为什么支持多种 `format`？

| 格式 | 特点 | 场景结构差异 |
|------|------|------------|
| `film` | 90-120分钟，三幕结构 | 场景较短，节奏紧凑 |
| `tv_series` | 40-60分钟/集，多集连载 | 有分集结构，每集有子高潮 |
| `stage_play` | 受舞台限制，场景少 | 场景转换少，依赖对话推动 |
| `web_series` | 5-15分钟/集，节奏快 | 场景简短，强钩子结尾 |
| `animation` | 视觉表现自由 | 场景描述更注重视觉奇观 |

不同格式决定了 AI 改编时的策略差异。例如，小说改编成动画可以保留更多想象力场景，改编成舞台剧则需要更集中的对话。

---

## 4. 完整示例

以下是一个基于《笑傲江湖》第一章改编的剧本片段示例：

```yaml
script:
  meta:
    title: "笑傲江湖·第一章改编"
    original_novel: "笑傲江湖"
    original_author: "金庸"
    script_author: "AI 改编助手 v1.0"
    version: "draft-1"
    created_date: "2026-06-07"
    format: "tv_series"
    genre: ["武侠", "剧情"]
    logline: "华山派大弟子令狐冲在江湖纷争中坚守本心，最终笑傲江湖。"
    synopsis: "令狐冲因救恒山派仪琳而与田伯光结仇，回山后被师父岳不群罚上思过崖面壁。"
    episode:
      season: 1
      episode_number: 1
      episode_title: "灭门"
    language: "zh-CN"
    tags: ["金庸", "武侠改编"]

  characters:
    - id: "linghu_chong"
      name: "令狐冲"
      role: "protagonist"
      age: "25"
      gender: "男"
      occupation: "华山派大弟子"
      description: "身材修长，眉目清秀，神色间自有一股洒脱不羁之气。"
      personality: ["洒脱", "重情义", "嗜酒", "不羁", "机智"]
      motivation: "追求自由，守护所爱之人"
      arc: "从自由散漫的浪子成长为有担当的江湖领袖"

    - id: "yue_buqun"
      name: "岳不群"
      role: "supporting"
      age: "50余岁"
      gender: "男"
      occupation: "华山派掌门"
      description: "面貌儒雅，举止斯文，人称'君子剑'。"
      personality: ["表面温和", "深藏不露", "城府极深"]
      motivation: "振兴华山派，夺取辟邪剑谱"

    - id: "lin_pingzhi"
      name: "林平之"
      role: "supporting"
      age: "19"
      gender: "男"
      occupation: "福威镖局少镖头"
      description: "俊美少年，原本生活优渥，因家逢巨变而性格大变。"
      personality: ["初时单纯", "倔强", "后渐偏执"]
      motivation: "为家族复仇"
      arc: "从天真正义的少年变为被仇恨吞噬的复仇者"

  structure:
    model: "three_act"
    act_count: 3
    acts:
      - act_number: 1
        title: "建置"
        summary: "引入主要角色和核心冲突：林平之灭门案、令狐冲救仪琳、岳不群真面目初露。"
        scene_range: [1, 18]
      - act_number: 2
        title: "对抗"
        summary: "令狐冲习得独孤九剑，卷入日月神教与五岳剑派的纷争，与任盈盈相识。"
        scene_range: [19, 36]
      - act_number: 3
        title: "解决"
        summary: "真相大白，岳不群自食其果，令狐冲与任盈盈退隐江湖。"
        scene_range: [37, 48]

  scenes:
    - scene_number: 1
      act: 1
      chapter_ref: 1

      location:
        name: "福州府西门大街"
        type: "EXT"
        description: "青石板路，两旁店铺林立，行人如织。天色渐暗，夕阳斜照。"
        props: ["茶摊招牌", "扁担"]

      time: "黄昏"
      time_of_day: "evening"

      summary: "林平之在福州街头打抱不平，误杀青城派余人彦，为林家埋下灭门之祸。"
      mood: "由轻松转向紧张"

      characters_present:
        - id: "lin_pingzhi"
          status: "present"
        - id: "yu_renyan"
          status: "present"

      beats:
        - type: "action"
          description: "夕阳西下，福州府西门大街热闹非凡。林平之骑马缓缓行来，神色悠闲。"
          characters: ["lin_pingzhi"]

        - type: "action"
          description: "路边茶摊，一名少女被两个汉子调戏。周围百姓敢怒不敢言。"
          characters: []

        - type: "dialogue"
          character: "lin_pingzhi"
          delivery: "normal"
          emotion: "愤怒"
          text: "住手！光天化日之下，欺辱弱女子，算什么好汉？"
          parenthetical: ""
          target: "yu_renyan"
          subtext: "我林家在福州地界上，岂容你们放肆。"

        - type: "action"
          description: "余人彦冷笑转身，手按剑柄，眼神轻蔑。"
          characters: ["yu_renyan"]

        - type: "dialogue"
          character: "yu_renyan"
          delivery: "normal"
          emotion: "轻蔑"
          text: "哪来的小白脸，也敢管爷的闲事？识相的赶紧滚！"
          parenthetical: ""
          target: "lin_pingzhi"
          subtext: "我是青城派的人，你惹不起。"

        - type: "action"
          description: "二人拔剑相斗。林平之剑法生涩但勇猛，余人彦剑法阴狠。数招过后——"
          characters: ["lin_pingzhi", "yu_renyan"]

        - type: "action"
          description: "林平之一剑刺入余人彦胸口。余人彦瞪大眼睛，缓缓倒地。周围百姓四散奔逃。"
          characters: ["lin_pingzhi", "yu_renyan"]
          camera: "特写：余人彦死不瞑目的表情"

        - type: "dialogue"
          character: "lin_pingzhi"
          delivery: "internal"
          emotion: "震惊、恐惧"
          text: "我……我杀人了？"
          parenthetical: "低头看着染血的剑，双手微微颤抖"
          subtext: "我闯了大祸，但我没有做错。"

        - type: "transition"
          value: "FADE OUT"

      conflict_level: "high"
      emotional_shift: "从悠闲到震惊、恐惧"
      key_dialogue: "我……我杀人了？"
      notes: "这是林平之命运的转折点。需强调他从富家公子到逃亡者的心理落差。"
      tags: ["关键转折", "第一幕"]

    - scene_number: 2
      act: 1
      chapter_ref: 1

      location:
        name: "福威镖局大厅"
        type: "INT"
        description: "大厅宽敞，正中悬'福威镖局'金字匾额。烛火摇曳，氛围凝重。"
        props: ["镖旗", "林家列祖牌位"]

      time: "当夜"
      time_of_day: "night"

      summary: "林平之回镖局向父亲林震南坦白杀人之事，林震南预感大祸临头。"
      mood: "凝重、不安"

      characters_present:
        - id: "lin_pingzhi"
          status: "present"
        - id: "lin_zhennan"
          status: "present"

      beats:
        - type: "action"
          description: "烛火摇曳，林震南坐在太师椅上，面色凝重。林平之跪在堂前，衣衫染血。"
          characters: ["lin_zhennan", "lin_pingzhi"]

        - type: "dialogue"
          character: "lin_zhennan"
          delivery: "normal"
          emotion: "沉重"
          text: "平之，你可知道那人是谁？"
          parenthetical: "缓缓起身"
          target: "lin_pingzhi"
          subtext: "事情比你想的严重得多。"

        - type: "dialogue"
          character: "lin_pingzhi"
          delivery: "normal"
          emotion: "不安"
          text: "孩儿不知……只知他剑法了得，绝非寻常江湖人。"
          parenthetical: "低头"
          target: "lin_zhennan"
          subtext: "父亲的表情让我害怕，我是不是连累了全家？"

        - type: "action"
          description: "林震南长叹一声，望向堂上'福威镖局'匾额，眼中闪过一丝绝望。"
          characters: ["lin_zhennan"]

        - type: "dialogue"
          character: "lin_zhennan"
          delivery: "normal"
          emotion: "绝望、自责"
          text: "余人彦……青城派余观主的独子。平之，你闯的祸……足以灭我林家满门。"
          parenthetical: "声音沙哑"
          target: "lin_pingzhi"
          subtext: "我苦心经营一生的镖局，怕是保不住了。"

        - type: "transition"
          value: "SMASH CUT TO"

      conflict_level: "medium"
      emotional_shift: "从不安排忧到绝望"
      key_dialogue: "你闯的祸……足以灭我林家满门。"
      notes: "这场父子的对话是灭门灾难的前奏。林震南的绝望预感与后续实际发生的惨剧形成对照。"
      tags: ["铺垫", "悲剧预兆"]
```

---

### 2.6 `dialogues` — 结构化对白（AI 优化后生成）

此节由 AI 对白优化功能生成，将剧本中所有对话抽取为扁平化结构，便于配音、字幕制作。

```yaml
dialogues:
  - character: string        # 角色 ID（引用 characters 列表）
    scene_number: int        # 所属场景编号
    index: int               # 在场景内的对话序号
    original: string         # 原始对白文本
    optimized: string        # AI 优化后的对白文本
    improvement: string      # 优化说明（如 "增强紧迫感，缩短句子"）
    emotion: string          # 情绪标签
    delivery: enum           # normal | voiceover | off_screen | internal
    target: string           # 对话目标角色 ID
```

**设计原因：**

| 考量 | 说明 |
|------|------|
| **AI 对白优化** | `original` 与 `optimized` 并存，编剧可对比原文与 AI 优化版，选择性采纳 |
| **配音生成** | 扁平化的对话列表可直接导入 TTS 引擎，`character` + `emotion` 控制音色和语气 |
| **字幕生成** | `character` + `optimized` 字段直接映射为字幕格式（角色名: 对白），无需额外解析 |
| **扁平化 vs 嵌套** | 从 `scenes[].beats[]` 中抽取为独立列表，配音/字幕工具无需理解完整剧本结构 |

### 2.7 `emotion` — 情绪标注（AI 分析后生成）

为每个角色在每个场景中的情绪状态提供结构化标注，服务于表演指导和情绪生成。

```yaml
emotion:
  character_emotions:        # 角色 × 场景 情绪矩阵
    角色ID:
      scene_1: "紧张"
      scene_2: "愤怒"
      scene_3: "释然"
  emotion_arcs:              # 角色情绪弧线
    角色ID:
      arc_description: "从压抑克制到彻底爆发的情绪递进"
      key_moments:
        - "场景3：发现真相时的震惊"
        - "场景7：与仇人对峙的爆发"
  performance_notes:         # 表演指导
    角色ID: "建议演员在前半段收敛情绪，用细微的眼神和肢体动作传递内心波动..."
  overall_tone: "沉重压抑中带着一丝温情"  # 全剧情绪基调
```

**设计原因：**

| 考量 | 说明 |
|------|------|
| **表演指导** | 演员拿到剧本后最常问的问题是"我这场戏是什么情绪？"。情绪矩阵直接回答这个问题 |
| **情绪一致性检查** | 通过情绪弧线（emotion_arcs）可以快速检查角色情绪发展是否合理、有无突兀跳跃 |
| **TTS/配音联动** | 结合 `dialogues` 的 `emotion` 字段和此处的角色级情绪，TTS 引擎可以精确控制每一句对白的语气 |
| **导演视角** | `overall_tone` 和 `performance_notes` 为导演提供全局参考，确保所有演员的风格统一 |
| **格式选择** | 使用 `角色ID.scene_N` 的映射格式（而非嵌套数组），因为查询场景只需一次键查找，比遍历数组更高效 |

### 2.8 `metadata` — 溯源元数据

保留剧本与原小说的映射关系，支持追溯和增量编辑。

```yaml
metadata:
  chapter_range: string        # 改编覆盖的章节范围，如 "第1章-第3章"
  source_text_length: integer  # 原文总字数
  script_generated_at: string  # 剧本生成时间（ISO 8601）
  conversion_model: string     # 使用的 AI 模型，如 "deepseek-chat"
  dialogue_optimized: boolean  # 是否已执行 AI 对白优化
  emotion_analyzed: boolean    # 是否已执行情绪分析
  revision: int                # 修订次数
  revision_history:            # 修订记录
    - version: 1
      timestamp: "2026-06-07T12:00:00Z"
      summary: "初稿生成"
    - version: 2
      timestamp: "2026-06-07T14:30:00Z"
      summary: "AI 对白优化 + 手动微调第3场景对话"
```

**设计原因：**

| 考量 | 说明 |
|------|------|
| **溯源（Traceability）** | `chapter_range` + `source_text_length` 保留了与原著的映射关系。当需要对照原文检查改编时，可知剧本覆盖了哪些章节 |
| **增量编辑** | `revision_history` 记录每次修改的时间、内容和版本，支持回溯到任意历史版本 |
| **AI 透明度** | `conversion_model` 记录了生成剧本所用的模型，区分人工修改与 AI 生成的内容 |
| **工作流状态** | `dialogue_optimized` 和 `emotion_analyzed` 是布尔标志位，编剧可快速了解当前剧本的完成状态，避免重复操作 |

---

## 5. 扩展与自定义

### 5.1 添加自定义字段

本 Schema 预留了多个扩展点：

- `meta.metadata`：任意键值对，适合项目级定制
- `scenes[].tags`：场景级自由标签
- `scenes[].notes`：场景级备注（接受 Markdown）

### 5.2 自定义格式转换

基于此 YAML Schema，可以转换为其他格式：

| 目标格式 | 转换难度 | 用途 |
|---------|---------|------|
| Fountain | 简单 | 导入 Final Draft、Celtx 等编剧软件 |
| PDF（标准剧本格式） | 中等 | 打印、提交 |
| FDX（Final Draft XML） | 中等 | Final Draft 原生格式 |
| CSV（分镜表） | 简单 | 拍摄计划、分镜制作 |

### 5.3 Schema 版本管理

- 主版本号变更（1.0 → 2.0）：不兼容的字段变更
- 次版本号变更（1.0 → 1.1）：新增可选字段，向后兼容
- 修订号变更（1.0.0 → 1.0.1）：文档修正，无 Schema 变更

---

## 附录 A：字段快速索引

| 字段路径 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| `script.meta.title` | string | 是 | 剧本标题 |
| `script.meta.format` | enum | 是 | 剧本格式 |
| `script.meta.logline` | string | 否 | 一句话梗概 |
| `script.scenes[].scene_number` | int | 是 | 场景编号 |
| `script.scenes[].location` | object | 是 | 场景地点信息 |
| `script.scenes[].beats[]` | array | 是 | 场景节拍序列 |
| `script.scenes[].beats[].type` | enum | 是 | 节拍类型 |
| `script.scenes[].beats[].text` | string | 条件 | 对话内容（dialogue 类型时必填） |
| `script.characters[].id` | string | 是 | 角色唯一标识 |
| `script.characters[].name` | string | 是 | 角色名称 |
| `script.structure.acts[]` | array | 否 | 幕结构定义 |

---

> **本文档与 AI 小说转剧本工具配套使用。**  
> Schema 会随工具迭代而更新，欢迎提出改进建议。
