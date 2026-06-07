# Novel2Script AI — 剧本 YAML Schema 规范

> 版本：2.0  
> 适用场景：AI 小说转剧本工具 · 结构化剧本输出  
> 格式：YAML 1.2  
> 编码：UTF-8

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [完整 Schema 定义](#2-完整-schema-定义)
3. [逐字段设计原因](#3-逐字段设计原因)
4. [完整示例：斗罗大陆前三章改编](#4-完整示例)
5. [扩展能力](#5-扩展能力)

---

## 1. 设计哲学

### 1.1 为什么选择 YAML 而非 JSON / XML / Fountain？

| 维度 | YAML | JSON | XML | Fountain |
|------|------|------|-----|----------|
| 人类可读性 | ★★★★★ | ★★★ | ★★ | ★★★★ |
| 结构层次表达 | ★★★★★ | ★★★★ | ★★★★★ | ★★ |
| AI 生成友好度 | ★★★★ | ★★★★★ | ★★★ | ★★ |
| 编剧工具互操作 | ★★★★ | ★★★ | ★★ | ★★★★★ |
| 版本控制 (Git) | ★★★★★ | ★★★★★ | ★★★★ | ★★★ |
| 原生注释支持 | ★★★★★ | ★ | ★★★★ | ★ |

**选择 YAML 的核心理由：**

1. **编剧友好** — 创作者多为非技术背景。`缩进即层级` 远比 `{}[]` 直观，接近自然阅读习惯。`#` 注释可随时批注。
2. **层次映射自然** — 剧本天然是层级结构：剧本 → 幕 → 场景 → 节拍 → 对白。YAML 的缩进完美映射。
3. **AI 生成准确度** — 相比 Markdown 的自由格式，YAML 有明确的结构锚点，AI 模型输出更可控，幻觉更少。
4. **行业桥接** — 可无损转换为 Fountain（Final Draft 导入）、FDX（Final Draft 原生）、CSV（分镜表）。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **渐进式复杂度** | 必填字段极少，编剧从最简骨架开始，逐步丰富。AI 先生成主干，再补充枝叶。 |
| **语义化命名** | 字段名直接反映剧本术语（`beat`、`parenthetical`、`logline`），零学习成本。 |
| **分离关注点** | 元数据、角色、结构、场景内容各自独立。修改角色设定不影响场景。 |
| **AI 友好** | 每个字段有明确类型约束，减少模型幻觉，提升输出一致性。 |
| **可追溯** | `chapter_ref` 和 `metadata` 保留与原著映射，支持增量编辑和版本回溯。 |

---

## 2. 完整 Schema 定义

### 2.1 顶层结构

```yaml
script:
  meta:         # 元数据（必填）
  characters:   # 角色库（推荐）
  structure:    # 叙事结构（可选）
  scenes:       # 场景序列（必填，核心）
  dialogues:    # 扁平对白列表（可选，AI 优化后生成）
  emotion:      # 情绪标注（可选，AI 分析后生成）
  metadata:     # 溯源信息（自动生成）
```

### 2.2 `meta` — 元数据

```yaml
meta:
  # === 必填 ===
  title: string             # 剧本标题
  format: enum              # film | tv_series | stage_play | web_series | animation

  # === 推荐 ===
  original_novel: string    # 原著小说名称
  original_author: string   # 原著作者
  script_author: string     # 剧本改编者
  version: string           # 版本号，如 "draft-2"
  created_date: string      # 创建日期，ISO 8601

  # === 可选 ===
  genre: [string]           # 类型标签，如 ["玄幻", "剧情"]
  logline: string           # 一句话梗概（25-35 字）
  synopsis: string          # 故事梗概（100-300 字）
  episode:                  # 仅电视剧/网剧
    season: int
    episode_number: int
    episode_title: string
  language: string          # 默认 "zh-CN"
  tags: [string]            # 自定义标签
```

### 2.3 `characters` — 角色库

```yaml
characters:
  - id: string              # 唯一标识（推荐中文名，如 "唐三"）
    name: string            # 角色显示名
    role: enum              # protagonist | antagonist | supporting | minor | cameo
    age: string             # 年龄，"6岁"、"30-35"
    gender: string          # 男 | 女
    occupation: string      # 职业/身份
    description: string     # 外貌气质描述
    personality: [string]   # 性格标签，如 ["坚毅", "沉稳", "重情义"]
    motivation: string      # 核心动机/欲望
    arc: string             # 角色弧线描述
    backstory: string       # 背景故事摘要
    relationships:          # 与其他角色关系
      - target: string      #   关联角色 ID
        type: string        #   父子、师徒、对立、爱情
        description: string
    notes: string
```

### 2.4 `structure` — 叙事结构

```yaml
structure:
  model: enum               # three_act | five_act | episodic | hero_journey
  act_count: int            # 幕数
  acts:
    - act_number: int
      title: string         # "建置"、"对抗"、"解决"
      summary: string
      scene_range: [int, int] # [起始场景编号, 结束场景编号]
```

### 2.5 `scenes` — 场景序列（核心）

```yaml
scenes:
  - scene_number: int       # 全局唯一，从 1 开始
    act: int                # 所属幕
    chapter_ref: int        # 对应原著章节（可追溯）

    location:
      name: string          #   地点名，如 "圣魂村后山"
      type: enum            #   INT | EXT | INT/EXT
      description: string   #   环境描述
      props: [string]       #   关键道具

    time: string            # 时间描述，如 "清晨"、"三天后"
    time_of_day: enum       # dawn | morning | noon | afternoon | evening | night
    summary: string         # 场景一句话概括
    mood: string            # 氛围/情绪基调
    conflict_level: enum    # low | medium | high | climax

    characters_present:
      - id: string          #   引用 characters 中的 id
        status: enum        #   present | mentioned | voice_only | flashback

    beats:                  # 场景节拍序列（按时间顺序）
      - type: action
        description: string #   动作/场景描述
        characters: [string]
        camera: string      #   镜头建议（可选）

      - type: dialogue
        character: string   #   说话角色 ID
        delivery: enum      #   normal | voiceover | off_screen | internal
        emotion: string     #   情绪标签
        text: string        #   对白内容
        parenthetical: string # 括号动作指示
        target: string      #   对话目标角色
        subtext: string     #   潜台词

      - type: transition
        value: enum         #   CUT TO | FADE IN | FADE OUT | DISSOLVE TO | SMASH CUT TO

    emotional_shift: string # 情绪变化："从不安到绝望"
    key_dialogue: string    # 关键台词/金句
    notes: string           # 编剧备注
```

### 2.6 `dialogues` — 扁平对白列表（AI 优化产物）

```yaml
dialogues:
  - character: string       # 角色名（已解析为中文）
    scene_number: int       # 所属场景
    index: int              # 场景内序号
    original: string        # 原始对白
    optimized: string       # AI 优化后对白
    improvement: string     # 优化说明
    emotion: string         # 情绪标签
    delivery: enum          # normal | voiceover | off_screen | internal
    target: string          # 对话目标
```

### 2.7 `emotion` — 情绪标注（AI 分析产物）

```yaml
emotion:
  character_emotions:       # 角色 × 场景 情绪矩阵
    唐三:
      scene_1: "深沉"
      scene_2: "坚毅"
      scene_3: "震惊"
  emotion_arcs:             # 角色情绪弧线
    唐三:
      arc_description: "从前世记忆的沉重到接受新世界的坚定"
      key_moments: ["穿越记忆觉醒时的茫然", "武魂觉醒时的震惊与坚定"]
  performance_notes:        # 表演指导
    唐三: "前期眼神深邃内敛，觉醒时刻瞳孔微缩，身体微微前倾"
  overall_tone: "沉重中带着希望，压抑中蕴含力量"
```

### 2.8 `metadata` — 溯源元数据

```yaml
metadata:
  chapter_range: string         # 改编覆盖的章节范围
  source_text_length: integer   # 原文字数
  script_generated_at: string   # 生成时间 (ISO 8601)
  conversion_model: string      # AI 模型名称
  dialogue_optimized: boolean   # 是否已执行对白优化
  emotion_analyzed: boolean     # 是否已执行情绪分析
  revision: int                 # 修订次数
  revision_history:             # 修订记录
    - version: 1
      timestamp: "2026-06-07T12:00:00Z"
      summary: "初稿生成"
```

---

## 3. 逐字段设计原因

### 3.1 为什么用 `beats` 而非"动作 + 对话"分离结构？

传统剧本格式将动作描述和对话块严格分开。但这丢失了**顺序信息**：

```
（动作）小明推开门
（对话）小明："你来了。"
（动作）他缓缓走向桌前
（对话）小红："我等了很久。"
```

分离结构无法表达"他缓缓走向桌前"发生在两句对话**之间**。`beats` 数组保留完整的时间顺序，每个节拍按发生顺序排列，完整还原叙事流。

### 3.2 为什么同时有 `time` 和 `time_of_day`？

- `time`：**人类可读的自由文本**。"那个雨一直下的黄昏" 保留文学性。
- `time_of_day`：**机器可解析的枚举值**。用于自动化场景排序、拍摄计划生成。

两者互补，不互相替代。

### 3.3 为什么角色使用 `id` 引用而非直接嵌入？

```yaml
# ✅ 引用式：单一数据源
characters_present:
  - id: "唐三"
    status: present

# ❌ 嵌入式：数据冗余，修改须遍历全部场景
characters_present:
  - name: "唐三"
    age: "6岁"
    description: "..."
```

1. **单一数据源** — 角色信息在 `characters` 中统一定义。修改年龄不需要遍历 50 个场景。
2. **AI 生成效率** — AI 只需输出角色 ID，而非每次重复完整描述，大幅减少 token 消耗。
3. **防止不一致** — 嵌入式容易导致同一角色在不同场景中出现矛盾信息。

### 3.4 为什么对话有 `subtext`（潜台词）？

这是本 Schema 区别于传统剧本格式的关键创新。

```
角色A："你走吧。"（text）
潜台词："别走，求你了。"（subtext）
```

- **指导演员表演** — 演员需要知道表面台词之下的真实情感。
- **提升 AI 改编质量** — AI 分析小说时会推断潜台词，显式记录供编剧审核修正。
- **增强剧本深度** — 好的剧本胜在潜台词。结构化后可统计全剧潜台词分布。

### 3.5 为什么有 `chapter_ref`？

`chapter_ref` 记录每个场景对应的原著章节。

- **溯源** — 编剧可随时回溯原著对应位置，检查改编是否遗漏。
- **覆盖度分析** — 统计"第 3 章被改编成了场景 5-8"，评估改编完整性。
- **增量更新** — 原著修改后，快速定位受影响的剧本场景。

### 3.6 为什么有 `conflict_level` 和 `emotional_shift`？

串联所有场景的 `conflict_level` 可生成**冲突强度曲线**，判断剧本是否有"过山车式"的张力变化。`emotional_shift` 确保每个场景都在推动角色或情节发生改变。

**静态的剧本是文字，动态的剧本是节奏。**

### 3.7 为什么有独立的 `dialogues` 扁平列表？

从 `scenes[].beats[]` 中抽取对话为独立列表，服务于三个下游场景：

| 场景 | 说明 |
|------|------|
| **配音生成** | `character` + `emotion` 直接控制 TTS 音色和语气 |
| **字幕制作** | `character` + `optimized` 直接映射为字幕格式 |
| **对白审阅** | `original` 与 `optimized` 并列，编剧可选择性采纳 AI 优化 |

### 3.8 为什么有独立的 `emotion` 情绪矩阵？

| 用途 | 说明 |
|------|------|
| **表演指导** | 演员问"我这场戏什么情绪？"，矩阵直接回答 |
| **情绪一致性检查** | 通过 `emotion_arcs` 检查情绪发展是否合理、有无突兀跳跃 |
| **导演统一风格** | `overall_tone` + `performance_notes` 确保所有演员风格一致 |
| **查询效率** | `角色ID.scene_N` 的映射格式，O(1) 查找，比遍历数组高效 |

### 3.9 为什么支持多种 `format`？

| 格式 | 场景数量 | 节奏特点 | AI 改编策略 |
|------|---------|---------|------------|
| `film` | 40-60 场 | 紧凑，三幕 | 保留关键情节，删减支线 |
| `tv_series` | 20-30 场/集 | 每集有子高潮 | 每章 2-3 场景，保留细节 |
| `stage_play` | 10-15 场 | 对话驱动 | 集中对话，减少场景转换 |
| `web_series` | 8-12 场/集 | 快节奏，强钩子 | 场景简短，结尾留悬念 |

---

## 4. 完整示例

以下基于《斗罗大陆》前三章改编的完整 YAML 剧本：

```yaml
script:
  meta:
    title: "斗罗大陆·武魂觉醒"
    original_novel: "斗罗大陆"
    original_author: "唐家三少"
    script_author: "Novel2Script AI"
    version: "draft-1"
    created_date: "2026-06-07"
    format: "tv_series"
    genre: ["玄幻", "穿越", "热血"]
    logline: "唐门弟子唐三穿越斗罗大陆，以废武魂蓝银草和先天满魂力踏上魂师之路。"
    synopsis: "唐三穿越到斗罗大陆圣魂村，觉醒前世唐门记忆后修炼玄天功。六岁时武魂觉醒，虽然武魂是废武魂蓝银草，却拥有罕见的先天满魂力和神秘的第二武魂。"
    language: "zh-CN"

  characters:
    - id: "唐三"
      name: "唐三"
      role: "protagonist"
      age: "6岁"
      gender: "男"
      occupation: "圣魂村村民 / 魂师学徒"
      description: "眼神深邃的六岁男孩，身材相比同龄人略显瘦削但异常坚韧。"
      personality: ["坚毅", "沉稳", "聪慧", "重情义"]
      motivation: "探索这个新世界，重振唐门绝学"
      arc: "从穿越迷茫到接受新身份，踏上魂师之路"
      backstory: "前世为唐门外门弟子，因偷学《玄天宝录》遭追杀，跳崖后穿越至斗罗大陆。"

    - id: "唐昊"
      name: "唐昊"
      role: "supporting"
      age: "中年"
      gender: "男"
      occupation: "铁匠"
      description: "身材魁梧，满脸胡渣，眼神浑浊但偶尔闪过精光。"
      personality: ["沉默寡言", "深藏不露", "颓废外表下有钢铁意志"]
      motivation: "暗中培养儿子唐三"
      relationships:
        - target: "唐三"
          type: "父子"
          description: "表面冷淡，内心深沉的爱与期待"

    - id: "素云涛"
      name: "素云涛"
      role: "minor"
      age: "26-27岁"
      gender: "男"
      occupation: "诺丁城武魂殿执事"
      description: "身穿武魂殿白色制服，胸佩三叶徽章，处事专业。"
      personality: ["专业", "公正", "见多识广"]

  structure:
    model: "three_act"
    act_count: 3
    acts:
      - act_number: 1
        title: "建置"
        summary: "唐三穿越觉醒记忆，修炼玄天功，接受父亲铁匠训练，参加武魂觉醒仪式。"
        scene_range: [1, 3]
      - act_number: 2
        title: "对抗"
        summary: "唐三以废武魂和先天满魂力前往诺丁学院，开始魂师之路。"
        scene_range: [4, 6]
      - act_number: 3
        title: "解决"
        summary: "唐三证明废武魂亦可成强者，踏上成为魂师的征途。"
        scene_range: [7, 8]

  scenes:
    - scene_number: 1
      act: 1
      chapter_ref: 1

      location:
        name: "圣魂村后山"
        type: "EXT"
        description: "小山包上，青草如茵，远处天际泛着鱼肚白。"
        props: []

      time: "清晨"
      time_of_day: "dawn"
      summary: "唐三坐在山包上，回忆前世唐门记忆，修炼紫极魔瞳。"
      mood: "深沉、内敛"
      conflict_level: "low"

      characters_present:
        - id: "唐三"
          status: "present"
        - id: "唐昊"
          status: "mentioned"

      beats:
        - type: "action"
          description: "清晨，薄雾笼罩圣魂村。唐三独自坐在后山小包上，双腿盘坐，面朝东方。"
          characters: ["唐三"]

        - type: "action"
          description: "天边鱼肚白渐亮，第一缕阳光穿透薄雾。唐三眼中紫光一闪而逝——紫极魔瞳每日必修课。"
          characters: ["唐三"]
          camera: "特写：唐三的双眸，紫光流转"

        - type: "dialogue"
          character: "唐三"
          delivery: "internal"
          emotion: "深沉、感慨"
          text: "唐门……我再也回不去了。"
          parenthetical: "低声自语"
          subtext: "我必须在这个新世界活下去，带着唐门的传承。"

        - type: "action"
          description: "山下传来唐昊粗犷的喊声。唐三身形轻巧弹跳而起，几个起落便到了山脚。"
          characters: ["唐三"]

        - type: "dialogue"
          character: "唐昊"
          delivery: "off_screen"
          emotion: "平淡"
          text: "小三——吃饭了——"
          parenthetical: ""
          subtext: ""

        - type: "transition"
          value: "CUT TO"

      emotional_shift: "从追忆到回归现实"
      key_dialogue: "唐门……我再也回不去了。"

    - scene_number: 2
      act: 1
      chapter_ref: 2

      location:
        name: "唐昊的铁匠铺"
        type: "INT"
        description: "昏暗的铁匠铺，火炉中的炭火忽明忽暗，墙上挂着各种铁器。"
        props: ["铁锤", "铁砧", "铁块"]

      time: "傍晚"
      time_of_day: "evening"
      summary: "唐昊在铁匠铺中向唐三讲述'神匠'之道，让唐三打铁一万下。"
      mood: "凝重、坚毅"
      conflict_level: "medium"

      characters_present:
        - id: "唐三"
          status: "present"
        - id: "唐昊"
          status: "present"

      beats:
        - type: "action"
          description: "铁匠铺内，炉火映照。唐昊难得没有喝酒，坐在铁砧旁，手拿铁锤。"
          characters: ["唐昊"]

        - type: "dialogue"
          character: "唐昊"
          delivery: "normal"
          emotion: "平静"
          text: "小三，过来。"
          parenthetical: ""
          target: "唐三"
          subtext: ""

        - type: "dialogue"
          character: "唐昊"
          delivery: "normal"
          emotion: "意味深长"
          text: "用凡铁打造出神器，才是神匠。上等的材料打造出来的神器并不稀奇，但能用最普通的材料打造出神器的，才是真正的神匠。"
          parenthetical: "目光深沉地看着手中的铁锤"
          target: "唐三"
          subtext: "儿子，你就像这块凡铁。"

        - type: "action"
          description: "唐昊将一柄比唐三还高的乌黑铁锤递过去。唐三咬牙接过，铁锤沉重，火星在炉火中四溅。"
          characters: ["唐三", "唐昊"]

        - type: "dialogue"
          character: "唐昊"
          delivery: "normal"
          emotion: "冷淡但暗含期待"
          text: "从明天开始，我教你打铁。打够一万下，才有资格做我的徒弟。"
          parenthetical: ""
          target: "唐三"
          subtext: "你要是连这个都做不到，就别想做魂师了。"

        - type: "action"
          description: "唐三高举铁锤，一锤落下，火星四溅。第二锤、第三锤……节奏渐稳。玄天功内力自行运转，手臂酸痛被温热驱散。唐昊眼中闪过惊讶。"
          characters: ["唐三", "唐昊"]
          camera: "慢镜头：铁锤落下的轨迹，火星飞溅，唐三额头汗珠滴落"

        - type: "transition"
          value: "DISSOLVE TO"

      emotional_shift: "从试探到暗许"
      key_dialogue: "用凡铁打造出神器，才是神匠。"
      notes: "唐昊的'神匠'言论是贯穿全书的隐喻——唐三最终以废武魂蓝银草成就神位。"

    - scene_number: 3
      act: 1
      chapter_ref: 3

      location:
        name: "圣魂村空置木屋"
        type: "INT"
        description: "一间空置木屋，六颗黑色石头按六芒星位置摆放，金色光罩笼罩。"
        props: ["六颗觉醒石", "记录本"]

      time: "三天后的上午"
      time_of_day: "morning"
      summary: "武魂觉醒仪式。唐三觉醒废武魂蓝银草与神秘第二武魂，同时拥有先天满魂力。"
      mood: "紧张、震惊、希望"
      conflict_level: "high"

      characters_present:
        - id: "唐三"
          status: "present"
        - id: "素云涛"
          status: "present"

      beats:
        - type: "action"
          description: "木屋内，六颗觉醒石亮起金光。素云涛手结法印，金色光罩笼罩八个孩子。"
          characters: ["素云涛"]

        - type: "dialogue"
          character: "素云涛"
          delivery: "normal"
          emotion: "平静、程式化"
          text: "孩子们，一个个走进法阵中央来。"
          parenthetical: ""
          subtext: ""

        - type: "action"
          description: "前四个孩子的武魂依次觉醒：公鸡、镰刀、锄头……素云涛一一摇头记录。唐三最后一个走入法阵。"
          characters: ["素云涛", "唐三"]

        - type: "action"
          description: "六颗石头金光猛然大盛——远超之前任何孩子。唐三右手一株淡蓝色蓝银草浮现，左手一柄乌黑古朴小锤若隐若现。"
          characters: ["唐三"]
          camera: "中景 → 特写：双手各持武魂，金光映照唐三坚毅的脸"

        - type: "dialogue"
          character: "素云涛"
          delivery: "normal"
          emotion: "震惊、难以置信"
          text: "蓝银草……废武魂。等等——双生武魂？！"
          parenthetical: "猛地站起身，瞳孔骤缩"
          subtext: "百年难遇的天才就在我面前。"

        - type: "action"
          description: "唐三身上浮现淡蓝色光芒——先天满魂力。素云涛几乎跳起，面色大变。"
          characters: ["唐三", "素云涛"]

        - type: "dialogue"
          character: "素云涛"
          delivery: "normal"
          emotion: "极度震惊"
          text: "先……先天满魂力？！废武魂却拥有先天满魂力……这完全颠覆了常理。"
          parenthetical: "声音发颤"
          subtext: "这个孩子的命运已经完全不同了。"

        - type: "action"
          description: "唐三低头看着双手中的蓝银草与黑锤，眼神从困惑变为坚定。玄天功的瓶颈似乎有所松动。"
          characters: ["唐三"]
          camera: "特写：唐三眼眸中倒映的武魂光芒"

        - type: "transition"
          value: "FADE OUT"

      emotional_shift: "从平凡到惊天"
      key_dialogue: "双生武魂？！……先天满魂力？！"
      notes: "全剧第一个高潮。唐三的双武魂和先天满魂力为后续剧情埋下核心伏笔。"

  dialogues:
    - character: "唐三"
      scene_number: 1
      index: 1
      original: "唐门……我再也回不去了。"
      optimized: "唐门……再也回不去了。"
      improvement: "去掉了'我'，更简洁，孤独感更强"
      emotion: "深沉"
      delivery: "internal"

    - character: "唐昊"
      scene_number: 2
      index: 1
      original: "用凡铁打造出神器，才是神匠。"
      optimized: "凡铁铸神器——那才是真正的神匠。"
      improvement: "对仗更工整，节奏更有力"
      emotion: "意味深长"
      delivery: "normal"

    - character: "素云涛"
      scene_number: 3
      index: 2
      original: "蓝银草……废武魂。等等——双生武魂？！"
      optimized: "蓝银草——废武魂？不对……双、双生武魂？！"
      improvement: "增加停顿和重复，震惊感更强烈"
      emotion: "震惊"
      delivery: "normal"

  emotion:
    character_emotions:
      唐三:
        scene_1: "深沉"
        scene_2: "坚毅"
        scene_3: "震惊→坚定"
      唐昊:
        scene_2: "平静→暗许"
      素云涛:
        scene_3: "程式化→极度震惊"
    emotion_arcs:
      唐三:
        arc_description: "从前世记忆的沉重怀念，到铁匠铺的坚毅隐忍，再到觉醒时刻的震惊与坚定"
        key_moments: ["山巅追忆唐门", "接过铁锤的瞬间", "双武魂浮现的震撼"]
    performance_notes:
      唐三: "眼神是关键——山巅时深邃迷离，打铁时坚毅专注，觉醒时从困惑到坚定。微表情变化比台词更重要。"
      素云涛: "前四个孩子觉醒时保持程式化的冷漠，轮到唐三后从皱眉到瞪眼到跳起，是一个完整的震惊递进。"
    overall_tone: "从深沉孤寂到压抑坚毅，最终在觉醒时刻如惊雷炸响"

  metadata:
    chapter_range: "第1章-第3章"
    source_text_length: 4523
    script_generated_at: "2026-06-07T12:00:00Z"
    conversion_model: "deepseek-reasoner"
    dialogue_optimized: true
    emotion_analyzed: true
    revision: 1
    revision_history:
      - version: 1
        timestamp: "2026-06-07T12:00:00Z"
        summary: "初稿生成，《斗罗大陆》第1-3章改编"
```

---

## 5. 扩展能力

### 5.1 格式转换

| 目标格式 | 转换难度 | 用途 |
|---------|---------|------|
| **Fountain** | 简单 | 导入 Final Draft、Celtx 等编剧软件 |
| **PDF（标准剧本）** | 中等 | 打印、提交制片方 |
| **FDX（Final Draft XML）** | 中等 | Final Draft 原生格式 |
| **CSV（分镜表）** | 简单 | 拍摄计划、AI 生图工具输入 |
| **JSON** | 简单 | API 对接、数据库存储 |

### 5.2 自定义扩展

Schema 预留了多个扩展点：

- `meta.tags` — 项目级自由标签
- `scenes[].notes` — 场景级备注（支持 Markdown）
- `scenes[].beats[].camera` — 镜头建议（未来可联动 AI 生图）
- `dialogues` — 独立对白层（未来可联动 TTS 配音引擎）
- `emotion` — 独立情绪层（未来可联动动画生成）

### 5.3 版本管理

- 主版本号（2.0 → 3.0）：不兼容的字段变更
- 次版本号（2.0 → 2.1）：新增可选字段，向后兼容
- 修订号（2.0.0 → 2.0.1）：文档修正，Schema 不变

---

> 本文档与 Novel2Script AI 工具配套使用。  
> Schema 随工具迭代持续更新，欢迎提出改进建议。
