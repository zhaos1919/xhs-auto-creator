
(function initXhsRenderWeb() {
  "use strict";

  var CANVAS_WIDTH = 1080;
  var CANVAS_HEIGHT = 1440;
  var PAGE_TYPES = Object.freeze(["auto", "list", "tag", "compare"]);
  var DOUBAO_DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
  var DOUBAO_DEFAULT_LAYOUT_STYLE = "xiaoxing_lab";
  var DOUBAO_PAGE_COUNT_MIN = 4;
  var DOUBAO_PAGE_COUNT_MAX = 8;
  var DOUBAO_DEFAULT_PAGE_COUNT = 5;
  var STORAGE_KEYS = Object.freeze({
    doubaoApiKey: "xhs_doubao_api_key",
    doubaoBaseUrl: "xhs_doubao_base_url",
    doubaoModel: "xhs_doubao_model",
    doubaoPageCount: "xhs_doubao_page_count",
    doubaoLayoutStyle: "xhs_doubao_layout_style"
  });
  var DOUBAO_SYSTEM_PROMPT = [
    "你是小红书图文排版 JSON 生成器。",
    "你必须严格遵守用户提示词中的所有结构与输出约束。",
    "你只能输出合法 JSON，不得输出解释。"
  ].join("\n");
  var DOUBAO_GENERATE_BUTTON_TEXT = "根据主题生成 JSON（豆包）";
  var DOUBAO_USER_PROMPT_TEMPLATE = `请按下面要求，生成一份可直接用于「小红书图文排版工具」的 JSON。

只输出合法 JSON，不要解释，不要 Markdown 代码块，不要额外说明。

====================
一、生成目标
====================
本次目标不是生成 HTML、SVG、Canvas 或图片代码，而是生成一份可直接喂给排版工具使用的 JSON 文本。

以 JSON 内容结构为唯一输出目标，所有要求都服务于：
1. 内容适合做成小红书高收藏图文。
2. 风格贴合我的账号调性。
3. 条目能被写作者直接保存、摘录、代入小说使用。

若主题中包含明确数字，则该数字既是封面卖点，也是正文交付承诺：
封面必须显式体现这个数字，正文必须完整兑现这个数字，且内页编号全局连续。

封面大标题必须直接输出为带中文双引号的完整主题，不得擅自缩写、删改、替换主题核心词；若主题较长，优先交给排版换行，不允许通过压缩主题来适配版面。

若主题属于命名类、清单类或代号类，不允许只输出名称本身；必须为每一条补足简短解释，做到“名字能用，解释也能直接放进设定表或正文里”。

整份 pages 不要生成任何“收尾页”“小提示页”“使用建议页”“总结页”“套用说明页”；所有内页都必须直接提供可用素材，不允许用最后一页做解释、提醒或凑页数。

====================
二、硬性结构要求
====================
1. style 字段必须是 "{layout_style}"
   - style 字段只用于控制排版风格，不是内容风格。
   - 不允许输出其他值。

2. content_style 字段必须根据用户输入的“风格:{style_label}”动态生成
   - 直接把 {style_label} 的语义转成简短的英文或拼音 slug 作为 content_style 值。
   - 例如：
     古风 → "guofeng"
     现言 → "xianyan"
     玄幻 → "xuanhuan"
     悬疑 → "xuanyi"
     校园 → "xiaoyuan"
     都市 → "dushi"
     仙侠 → "xianxia"
     通用 / 泛用 → "general"
   - 如果用户输入的风格不在以上列表，按同样规则自行转写成 slug，全小写，不加空格。
   - content_style 仅用于内容分类元数据，不影响实际渲染。

3. 必须包含以下字段：
   - style
   - content_style
   - cover_top_text
   - cover_title
   - pages

4. cover_top_text 是封面上方小字，写成栏目提示感，控制在 6 到 10 个汉字
   - 优先写成“写小说可用的”“可以写进小说里的”“写小说必存的”这一类。
   - 不要堆卖点。
   - 不要写成完整宣传语。
   - 语气要克制、安静、有整理感，不要像营销标题。

5. cover_title 是封面中央大字
   - cover_title 必须始终带中文弯引号，格式固定为：\`“{封面标题}”\`
   - 例如：
     \`“神性悲悯台词”\`
     \`“50个杀手代号”\`
     \`“病娇告白句子”\`
   - 必须使用中文弯引号“”。
   - 不允许省略引号。
   - 不允许使用英文引号 ""。
   - 不允许只加一边引号。
   - 不允许把引号放到渲染层再补，JSON 输出时就必须直接带完整引号。
   - 默认情况下，cover_title 应尽量直接使用主题本身，或完整保留主题核心表达。
   - 不允许擅自缩写、简写、压缩、替换主题中的核心词。
   - 不允许把“神性悲悯台词”改成“神悯台词”。
   - 不允许把“疯批病娇语录”改成“病娇语录”。
   - 不允许把“50个杀手代号”改成“50个代号”。
   - 不允许把“清冷破碎感女主描写”改成“破碎感女主”。
   - 如果主题中自带明确数字（如“40个”“50个”“100条”“7组”），则 cover_title 必须显式保留这个数字。
   - 如果主题本身字数较长，也不能擅自删词压缩。
   - 应优先通过换行排版去适配封面，而不是改短主题。
   - cover_title 的核心原则只有两个：
     1. 必须带完整中文双引号；
     2. 必须保留用户主题的完整核心表达，不得私自缩减。

5b. 主题保真规则
   - 用户输入的主题是内容生成的最高优先级，不允许擅自改写其核心表达。
   - 允许做的调整，仅限于：
     - 加中文双引号；
     - 在不改变原意的前提下补充极少量必要格式字符。
   - 不允许做的调整包括：
     - 缩写；
     - 简称化；
     - 用近义词替代；
     - 删除主题中的限定词；
     - 删除主题中的风格词；
     - 删除主题中的数字；
     - 把具体主题改成更泛的说法。
   - 例如：
     主题“神性悲悯台词” → cover_title 应为 \`“神性悲悯台词”\`
     主题“50个杀手代号” → cover_title 应为 \`“50个杀手代号”\`
     主题“清冷破碎感女主描写” → cover_title 应为 \`“清冷破碎感女主描写”\`
   - 若主题较长，宁可分两行显示，也不能擅自删改主题本身。

6. cover_tag_text 固定输出为：
   - "小说素材、干货分享"
   - 这是账号固定标签，不允许结合主题改写。
   - 如果排版工具不接收这个字段，也必须在生成逻辑中默认这个标签是固定文案。
   -不允许把标签擅自改成：豆包自动生成

7. pages 输出 {page_count} 页
   - 每页必须有 title 和 items。
   - 可额外带 type 字段。

7b. pages 的每一页都必须是有效素材页
   - 不要生成“收尾小提示”页。
   - 不要生成“这些素材怎么用”页。
   - 不要生成“写作建议”页。
   - 不要生成“总结”页。
   - 不要生成“注意事项”页。
   - 不要生成“最后补充”页。
   - 不要用任何一页专门承载说明性废话或收尾文案。
   - 即使是最后一页，也必须继续提供新的、可直接摘录的成品素材。

8. type 可写 auto，也可显式写：
   - list
   - tag

9. 页型要求：
   - list：items 是字符串数组。
   - tag：items 也是字符串数组，但不要求使用【】标签格式。
   - 整份 JSON 以 list 为主。
   - tag 仅作为可选分组页型使用，不强制出现。
   - 不要输出 compare 页型。
   - 不要输出 normal / better 结构。
   - 不要输出任何带【】标签前缀的条目格式。

【禁止出现的页标题示例】
以下类型标题都不要出现：
- 最后的小提示
- 这些素材怎么用
- 可直接套用的小技巧
- 写在最后
- 使用建议
- 最后提醒
- 如何把这些写进小说
- 收尾补充
-豆包生成

如果需要表达用途，应该直接写进每条素材自身的短解释里，而不是单独做一页。

====================
三、数字型主题强制规则
====================
当主题中出现明确数字时（如“20个”“40个”“50个”“100条”“7组”“12句”），生成内容必须遵守以下规则：

1. 数量必须严格兑现
   - 主题要多少，就必须给够多少。
   - 不能少给。
   - 不能用“部分示例”“先给一半”这类方式缩水。
   - 例如：
     主题“50个杀手代号” → 必须输出整整 50 个杀手代号。
     主题“40个疯批台词” → 必须输出整整 40 条疯批台词。
     主题“100个古风地名” → 必须输出整整 100 个古风地名。

2. 编号必须全局连续
   - 内页内容必须按全局序号连续排列。
   - 编号从 1 开始，到主题要求的数字结束。
   - 不允许跳号。
   - 不允许重复编号。
   - 不允许页与页之间重新从 1 开始。
   - 例如：
     若主题为“50个杀手代号”，则必须连续输出 1 到 50。
     第一页可为 1-7，第二页 8-14，第三页 15-21……直到 50。

3. 跨页时也必须延续编号
   - pages 只是分页，不是重新计数。
   - 每一页都要承接上一页末尾的下一个编号。
   - 页与页之间不能断裂，不能回退。

4. 数字型主题优先保证“完整交付”
   - 如果主题本身是“XX个名字 / XX条句子 / XX组设定 / XX个代号”这类集合型内容，
     则“完整列满数量”优先级高于页型变化。
   - 在这种情况下，应以 list 为主来承载内容。
   - 核心原则是：先给够，再分页，再优化节奏。

5. 每一条都必须是独立可用内容
   - 不能为了凑数字而拆半句。
   - 不能把一条内容硬拆成两条。
   - 不能用“同上”“类似上条”“可自行替换”来充数。
   - 每一条都必须能单独截图、单独摘录、单独使用。

6. 若主题是“命名类 / 清单类 / 代号类 / 地名类 / 组织名类 / 招式名类”
   - 不能只给名称本身，必须为每一条配一个简短解释。
   - 解释不需要过分长，但必须把事物讲清楚，让用户知道它是什么、适合放在哪、带什么气质或功能。
   - 每一条都应尽量采用“名称 + 短解释”的完整成品格式，而不是只堆名字。
   - 不允许出现整页只有名字、没有解释的情况。
   - 不允许只对少数条目解释、其余条目裸列名称。
   - 主体仍然必须是完整数量本身，解释是附着在每个条目后的简洁说明，不是另起大段讲解。
   - 例如“50个杀手代号”，应输出 50 个“代号 + 解释”的完整条目，而不是只列 50 个词。
   - 例如“50个地名”，应输出 50 个“地名 + 地域气质 / 地貌特征 / 功能定位”的完整条目，而不是只列地名。

7. 若主题带数字，items 中的每条内容建议显式带全局序号
   - 例如：
     "1. 乌骨：适合沉默寡言型杀手，像从旧伤里活下来的人。"
     "2. 雪隼：适合远距猎杀型角色，冷、准、来去都不留痕。"
     "3. 断潮：适合任务后彻底失联的人，名字里有一种断尾般的狠。"
   - 这样可以确保跨页后仍保持 1 到 N 的完整连续性。
   - 尤其是 30 个以上的大数量主题，必须保证用户在内页能直接看到连续编号。

8. 若主题中的数字已经是卖点，封面和内页都必须强化这个数字
   - cover_title 必须带数字。
   - 内页条目必须按这个数字完整展开。
   - 不允许封面写“50个”，正文实际只给 18 个。

====================
四、标点结尾强制要求
====================
【必须加结尾标点的字段 —— 正文类】
1. 所有正文类字段在结尾处都必须带上符合语境的中文标点，不允许裸结尾。涉及字段：
   - list 型每一条 item
   - tag 型每一条 item

2. 标点按实际语境自然选择，不要全部一刀切用句号：
   - 陈述、描写、设定 → 句号“。”
   - 强情绪、动作爆发、惊叹 → 感叹号“!”
   - 未尽、留白、余韵、暧昧、延续感 → 省略号“……”
   - 疑问、反问、自问 → 问号“?”
   - 并列短语收束 → 句号“。”

3. 标点要有节奏变化
   - 不要整页所有条目都用句号。
   - 省略号、感叹号、问号要按内容自然分布。

【禁止加结尾标点的字段 —— 标题类】
4. 下列字段原则上不加句末标点：
   - cover_top_text
   - 页 title

5. cover_title 为特殊例外：
   - cover_title 不加句号、问号、感叹号、省略号等句末标点；
   - 但必须带完整中文双引号“”；
   - 也就是说，cover_title 的合法形式应为：
     \`“神性悲悯台词”\`
     \`“50个杀手代号”\`
   - 不允许写成裸标题。
   - 不允许缺少首尾引号。

【禁止出现的错误写法】
6. 正文条目出现以下任一情况均为错误：
   - 裸结尾
   - 用英文句点 "." 代替 "。"
   - 用三个点 "..." 或单个 "…" 代替六点省略号 "……"
   - 一条里叠用多个结尾标点，如“。。”、“!!”、“??”

====================
五、内容核心定位
====================
这是一份“写作者会保存下来以后真的拿去用”的素材笔记，
不是讲解，不是教程，不是知识点整理。

用户打开这一篇，第一反应应该是：
“这一页我存下来，下次卡文直接翻。”

每一条的衡量标准只有一个：
这句话 / 这个词 / 这个设定 / 这个替换，
是不是能被作者直接复制进自己的小说里。

不能直接用的，再正确也不要写。

这不是教程型图文，也不是结尾带提醒的话术型图文。
不需要“最后告诉你怎么用”，因为每一页本身就应该直接能拿去用。

====================
六、账号风格整合要求
====================
这一份 JSON 的内容气质，必须贴合我的账号固定风格：

1. 整体调性：
   - 文学感
   - 治愈感
   - 克制
   - 安静
   - 柔和
   - 高级留白
   - 小红书高收藏图文风

2. 内容表达上要体现：
   - 不要喊叫式表达。
   - 不要强推销感。
   - 不要密集堆卖点。
   - 不要“宝子们”“狠狠码住”“直接抄作业”这类平台营销腔。
   - 要像认真整理素材的写作者，不像运营号。

3. 封面文案层级感要提前体现在 JSON 文案里：
   - cover_top_text 负责“栏目提示感”。
   - cover_title 负责“封面记忆点”。
   - 固定标签始终是“小说素材、干货分享”。
   - 封面整体读起来要有安静、稳、耐看的感觉，而不是炸眼、夸张、喊口号。

4. 封面主标题的语言要求：
   - 适合被单独放大。
   - 不要太虚。
   - 不要过长。
   - 不要写成解释句。
   - 必须优先完整保留用户主题。
   - 若主题较长，交由排版换行，不允许私自压缩标题。

5. 内页标题的语言要求：
   - 清楚。
   - 有分节感。
   - 不故作玄虚。
   - 能直接让用户判断这一页值不值得存。

6. 整体避免以下感觉：
   - 卡通感
   - 插画感
   - 花哨感
   - 过度装饰感
   - 荧光高饱和感
   - 过度网感烂梗

7. 虽然只输出 JSON，但内容必须默认适配“小红书固定模板”：
   - 封面标签固定。
   - 封面标题需要完整保留主题并适合单独成势。
   - 内页条目需要适合分页排版。
   - 不能出现超长、失控、视觉上很难放进图片的句子堆。

====================
七、素材密度要求
====================
1. 每页至少 70% 是可直接摘录的成品素材，最多 30% 是点明用途的短说明。

2. 优先给这些类型的硬素材：
   - 可直接代入正文的句子
   - 可直接替换的描写表达
   - 可直接套用的台词
   - 可直接取用的人名、地名、器物名、招式名、组织名
   - 可直接嵌入的场景短句
   - 可直接补丁到人设上的细节
   - 可直接调用的情绪表达
   - 带机制、带代价、带触发条件、带限制、带旁证的设定片段

3. 一条内容能不能被截图单独使用，是能否入选的关键。

4. 不要把条目写成：
   - “XX很重要”
   - “要注意XX”
   - “记得XX”
   这类属于讲解，直接删掉。

5. 不要每条都解释“为什么这样写更好”，把篇幅让给素材本身。

6. 不允许专门拿一整页写“小提示”“使用方法”“适用场景总结”“可用于……”这类说明性内容。
   - 这些信息如果确实必要，只能极少量融入单条素材解释里。
   - 不能单独占一页。

====================
八、语言与语感要求
====================
1. 顺口、自然、符合中文语感
   - 像作者在本子上整理。
   - 不像运营在做文案。

2. 允许个别句子更抓人，但整体以“能落笔”为第一目标。

3. 严禁出现下列营销词与空词：
   - 建议收藏
   - 狠狠码住
   - 直接抄作业
   - 封神
   - 绝绝子
   - 谁懂
   - 宝子们
   - 太绝了
   - 这篇必须收藏
   - 一看就会

4. 严禁反复堆这些万金油词：
   - 高级感
   - 氛围感
   - 破碎感
   - 宿命感
   - 拉满了
   - 绝美
   - 神级
   - 确需使用时，后面必须立刻接具体画面或机制，不能孤零零出现。

5. 不要为了显得会写而堆辞藻，堆出来的华丽句子一律删掉。

6. 允许小众、有网感的表达，但必须是中文写作者看得懂、用得上的那种，不是平台烂梗。

7. 语言风格要贴合 {style_label} 本身语境：
   - 古风 / 仙侠：多用凝练文言感、器物名、节气、方位词。
   - 现言 / 都市：多用生活化具象细节、现代物件、轻口语。
   - 玄幻：多用规则、体系、代价、禁忌词。
   - 悬疑：多用反常、错位、旁证、失衡描写。
   - 校园：多用青春感官细节、时间节点、环境锚点。
   - 通用：泛用性优先，不过度贴某一具体题材。

====================
九、条目数量与字数（按页型分档）
====================
排版容量有限，任何一页都不允许超出图片。以下条数均为硬上限，不得突破。

【A档 · 可摘录型素材页 —— 长句页】
适用页型：
句子素材页、短句素材页、词语素材页、台词素材页、情绪表达页、场景描写页、替换表达页（list 型或 tag 型）、以及任何“内容本身就是可直接抄走的成品句”的页。

- 每条字数：35 到 60 个汉字为主。
- 精彩的长句最多放宽到 65 字，不得再长。
- 每页条数硬上限：最多 9 条。
- 推荐区间：
  - list 型 7 到 9 条
  - tag 型 6 到 8 条
- 如果单条普遍偏长（平均 55 字以上），条数下调到 6 到 7 条。
- 每条必须是一句完整的、有画面、有落点的成品素材。
- 不能只是一个词组或半句话。
- 宁可一页只放 6 到 7 条饱满长句，也不要硬塞到 9 条导致排版溢出。

【B档 · 设定 / 机制 / 人设补丁页 —— 中句页】
适用页型：
人设细节补丁页、剧情桥段素材页、设定页、命名清单页。

- 每条字数：25 到 45 个汉字为主。
- 每页条数硬上限：最多 8 条。
- 推荐区间：6 到 8 条。
- 命名清单类条目更短时，可放到 8 条上限。
- 但每页至少附带 2 到 3 条带解释的用法示范。

【通用规则】
1. 先想清楚这一页每条大概多长，再决定条数。
2. 不同页的条数要有变化，不要整份 JSON 每页都卡在上限。
3. 句子长度要有节奏。
4. 页面节奏要拉开。
5. 不许为了凑字数灌水。
6. 不许为了多塞内容超过条数上限。

【数字型主题补充优先级】
如果主题中带有明确数字，且该数字本身代表必须完整交付的内容总量，
则必须优先满足“总数完整”和“编号连续”。

也就是说：
- 先保证总条目数达到主题要求；
- 再根据页数分页；
- 再控制单页条数与版面节奏。

不得为了追求页型平均、留白均匀或形式变化，而少给内容、跳号、断号或漏号。

====================
十、命名类主题解释规则
====================
当主题属于以下类型时：
- 地名
- 人名
- 杀手代号
- 组织名
- 门派名
- 招式名
- 器物名
- 城池名
- 国家名
- 清单型设定名录

必须遵守以下规则：

1. 每一条都必须是“名称 + 短解释”的完整结构
   - 不能只写名称。
   - 不能只有极少数条目带解释。
   - 不能解释忽长忽短到严重失衡。

2. 解释长度要克制
   - 以短解释为主。
   - 一般控制在 10 到 28 个汉字左右。
   - 最长尽量不要超过 36 个汉字。
   - 目标是“讲清楚”，不是“展开讲故事”。

3. 解释必须有信息量
   - 不能只写空话。
   - 不能只写“很好听”“很适合小说”“有氛围感”这类无效描述。
   - 必须交代至少一个可用信息点。

4. 地名类优先解释这些信息：
   - 地貌特征
   - 地理方位
   - 气候气质
   - 城镇功能
   - 人文印象
   - 适合出现在哪类剧情中

5. 杀手代号类优先解释这些信息：
   - 代号气质
   - 代号来源
   - 擅长方向
   - 行事风格
   - 危险特征
   - 适合对应哪类角色

6. 组织名 / 门派名 / 招式名 / 器物名类优先解释这些信息：
   - 核心功能
   - 使用场景
   - 风格属性
   - 禁忌 / 代价 / 象征意义
   - 适合放在什么设定里

7. 解释必须服务“可直接使用”
   - 用户看到后，最好能直接复制到小说设定表里。
   - 或者稍改一个字就能放进正文。
   - 不能写成百科式释义。
   - 不能写成教程式说明。

8. 推荐格式
   - "1. 上海：临海巨埠，适合写旧梦、商战与人潮夜色。"
   - "2. 断潮：适合冷硬型杀手，像会在任务后彻底断联的人。"
   - "3. 青崖谷：多雾多石，适合藏旧宗门与失踪线索。"

9. 若主题数量很大（如 40 个、50 个、100 个）
   - 也必须保证每一条都带解释。
   - 宁可缩短解释，也不能把解释整批删掉。
   - 核心原则是：每条都讲清楚一点点，而不是少数几条讲很多、其余只报名字。

10. 命名类主题的解释必须附着在每个条目后面完成，不要把解释集中挪到最后一页统一说明。

====================
十一、内容质量细则
====================
1. 每一条都要具体，带画面、带方法、带钩子。
2. 不写概念词，不写正确的废话。
3. 至少一半条目要带以下要素之一：
   - 触发条件
   - 代价
   - 限制
   - 具体器物
   - 具体地点
   - 时间错位
   - 身份规则
   - 旁证细节
   - 反常反应
   - 生理反应

4. 尽量少写“天生一对、双向救赎、命中注定”这种空泛结论。
   - 除非后面立刻补上具体机制。

5. 多写这些层次，避免只停在常见网文套路：
   - 代价型
   - 器物型
   - 地理锚点型
   - 错认型
   - 非爱情向
   - 平行时空型
   - 旁证线索型
   - 感官错位型
   - 时间延迟型

6. 同一页条目之间不要互相重复，不是换个说法再写一遍。

====================
十二、隐藏自检（不输出过程）
====================
输出前先做一遍自检，只调整结果，不写出自检内容：

1. style 是否已设置为 {layout_style}。
2. content_style 是否已根据 {style_label} 生成对应 slug。
3. 是否包含 style、content_style、cover_top_text、cover_title、pages。
4. cover_tag_text 是否固定为“小说素材、干货分享”。
5. cover_top_text 和页 title 结尾是否都没有句末标点。
6. 所有正文类字段结尾是否都带中文标点。
7. 标点是否有节奏变化，不是整页都句号。
8. 是否存在裸结尾、英文句点、三点省略号、叠加标点等错误写法。
9. A 档页面每页条数是否 ≤ 9。
10. B 档页面每页条数是否 ≤ 8。
11. A 档页若平均字数超过 55 字，条数是否已下调到 6-7 条。
12. 是否出现“整份 JSON 每页都卡上限”的情况。
13. 是否句子长度高度一致、句式雷同。
14. 随机抽 5 条可摘录类素材，是否都能被作者直接抄进小说里。
15. 是否出现被禁用的营销词和空词。
16. 封面文案是否符合“文学感、治愈感、克制、安静、柔和”的账号风格。
17. cover_title 是否完整保留了用户主题，而不是被压缩成简称。
18. 如果主题中带有明确数字，是否已严格输出对应总数量，而不是缩水。
19. 如果主题中带有明确数字，内页编号是否已做到全局连续，不跳号、不重号、不回号。
20. cover_title 是否显式保留了主题中的数字，没有被改成模糊表达。
21. 若是命名类 / 清单类 / 代号类主题，主体内容是否以“成品本身”为主，而不是被解释性文字挤占。
22. 若主题是“50个 / 40个 / 100个”这类大数量主题，是否已经合理分页，并保证每页承接上页编号继续往下排。
23. 是否只使用了 list / tag / auto，没有输出 compare。
24. 是否完全没有输出带【】标签前缀的条目。
25. cover_title 是否已经带完整中文双引号“”，而不是裸标题。
26. cover_title 是否使用了中文弯引号，而不是英文引号。
27. cover_title 是否完整保留了用户主题核心表达，没有擅自缩写、删词、替换。
28. 若主题较长，是否优先保留原主题并交给排版换行，而不是私自压缩标题。
29. 若主题中包含数字、限定词、风格词，它们是否都被完整保留在 cover_title 中。
30. 若主题属于命名类 / 清单类，是否每一条都已写成“名称 + 短解释”，而不是只列名称。
31. 解释是否足够短，不拖沓，但又能把事物讲清楚。
32. 解释里是否至少包含一个有效信息点，而不是“好听、绝美、有氛围感”这类空话。
33. 若主题数量较大，是否依然保证每一条都有解释，没有后半段偷懒改成纯名称罗列。
34. 是否完全没有生成“收尾页”“小提示页”“使用建议页”“总结页”“注意事项页”。
35. 最后一页是否仍然在继续给新素材，而不是改成解释性收尾。
36. 是否不存在整页只有说明、没有新素材的页面。
37. 最终只输出 JSON。

====================
十三、输出字段格式
====================
标题类字段中：
- cover_top_text 和页 title 结尾不带句末标点；
- cover_title 必须带完整中文双引号；
正文类字段结尾必须带标点。

命名类 / 清单类主题的 items 输出格式建议为：
"序号. 名称：简短解释。"

例如：
"1. 上海：临江近海，适合写旧租界、霓虹夜雨与权钱往来。"
"2. 断潮：冷硬克制，适合不留余地、任务后彻底失联的杀手。"

若使用该格式，名称后应用中文冒号“：”，整条结尾仍必须保留中文标点。

示例如下：

{
  "style": "{layout_style}",
  "content_style": "xuanyi",
  "cover_top_text": "写小说可用的",
  "cover_title": "“50个杀手代号”",
  "cover_tag_text": "小说素材、干货分享",
  "pages": [
    {
      "title": "冷硬锋利的杀手代号",
      "type": "list",
      "items": [
        "1. 乌骨：适合沉默寡言型杀手，像从旧伤里活下来的人。",
        "2. 雪隼：适合远距猎杀型角色，冷、准、来去都不留痕。",
        "3. 断潮：适合任务后彻底失联的人，名字里有一种断尾般的狠。",
        "4. 玄釭：古意很重，适合用冷兵器、出身旧组织的杀手。"
      ]
    },
    {
      "title": "适合直接放进小说的地名",
      "type": "list",
      "items": [
        "1. 上海：临江近海，适合写旧梦、商战、租界余影与霓虹夜雨。",
        "2. 青崖谷：多雾多石，适合藏旧宗门、悬案线索与避世人物。",
        "3. 落霞关：带边塞感，适合写守关旧部、风沙来信与迟来的归人。",
        "4. 听松渡：偏江南气，适合写别离、夜船、旧友重逢与秘密交易。"
      ]
    }
  ]
}

====================
十四、本次生成
====================
主题:{topic}
风格:{style_label}
排版风格:{layout_style}
页数:{page_count}
目标感觉：
让用户看到后有收藏、点赞、转发欲望，觉得内容密、信息足、句句能直接用于写作；
同时整体气质要贴合我账号一贯的小红书风格：文学感、治愈感、克制、柔和、安静、高级留白。`;
  var STYLE_LABEL_TO_SLUG = Object.freeze({
    "古风": "guofeng",
    "现言": "xianyan",
    "玄幻": "xuanhuan",
    "悬疑": "xuanyi",
    "校园": "xiaoyuan",
    "都市": "dushi",
    "仙侠": "xianxia",
    "通用": "general",
    "泛用": "general",
    general: "general"
  });

  var STYLE_PROFILES = Object.freeze({
    xiaoxing: {
      id: "xiaoxing",
      name: "Xiaoxing",
      theme: "default",
      background: {
        styleKey: "xiaoxing",
        allowFallback: true
      }
    },
    xiaoxing_lab: {
      id: "xiaoxing_lab",
      name: "Xiaoxing Lab",
      theme: "xiaoxing_lab",
      background: {
        styleKey: "xiaoxing_lab",
        allowFallback: false
      },
      colors: {
        textPrimary: "#111111",
        textSecondary: "#171717",
        ornamentDark: "#2E3335",
        ornamentLight: "#8A8F8D"
      },
      ornaments: {
        topLeftDotsX: 76,
        topLeftDotsY: 103,
        topLeftDotRadius: 7,
        topLeftDotGap: 19,
        topLeftDotLineWidth: 2,
        topRightQuoteX: 964,
        topRightQuoteY: 134,
        topRightQuoteFontSize: 96,
        bottomLeftQuoteX: 74,
        bottomLeftQuoteY: 1368,
        bottomLeftQuoteFontSize: 96,
        bottomLineX1: 160,
        bottomLineX2: 989,
        bottomLineY: 1407,
        bottomLineWidth: 2.5
      },
      layout: {
        cover: {
          topTextX: 124,
          topTextY: 530,
          topTextWidth: 828,
          topTextLineHeight: 86,
          topTextMaxLines: 1,
          titleX: 82,
          titleY: 722,
          titleWidth: 922,
          titleLineHeight: 122,
          titleMaxLines: 2,
          subtitleX: 108,
          subtitleY: 1080,
          subtitleWidth: 610,
          subtitleLineHeight: 68,
          subtitleMaxLines: 1
        },
        page: {
          bodyX: 76,
          bodyY: 274,
          bodyWidth: 923,
          bodyMaxY: 1266,
          itemLineHeight: 70,
          itemGap: 22
        }
      }
    },
    rifu: {
      id: "rifu",
      name: "RiFu",
      theme: "rifu",
      background: {
        styleKey: "rifu",
        allowFallback: false
      },
      colors: {
        textPrimary: "#111111",
        textSecondary: "#1D1B18",
        decorOlive: "#7A7048"
      },
      typography: {
        fontFamily: "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif",
        coverTopSize: 58,
        coverTopWeight: 500,
        coverTitleStartSize: 132,
        coverTitleMinSize: 86,
        coverTitleWeight: 700,
        coverSubtitleStartSize: 60,
        coverSubtitleMinSize: 46,
        coverSubtitleWeight: 600,
        pageTitleSize: 54,
        pageTitleWeight: 700,
        bodySize: 40,
        bodyWeight: 500,
        leadWeight: 700
      },
      layout: {
        cover: {
          topTextX: 110,
          topTextY: 372,
          topTextWidth: 313,
          topTextLineHeight: 66,
          topTextMaxLines: 1,
          titleCenterX: 540,
          titleY: 706,
          titleWidth: 860,
          titleLineHeight: 124,
          titleMaxLines: 2,
          subtitleCenterX: 540,
          subtitleY: 1200,
          subtitleWidth: 420,
          subtitleLineHeight: 66,
          subtitleMaxLines: 1
        },
        page: {
          titleX: 68,
          titleY: 122,
          titleWidth: 930,
          titleLineHeight: 64,
          titleMaxLines: 1,
          bodyX: 68,
          bodyY: 176,
          bodyWidth: 934,
          bodyMaxY: 1248,
          itemLineHeight: 48,
          itemGap: 52
        }
      }
    },
    banxia: {
      id: "banxia",
      name: "Banxia 416",
      theme: "banxia",
      coverSubtitle: "小说素材｜写作技巧｜干货分享",
      background: {
        styleKey: "banxia",
        allowFallback: false
      },
      colors: {
        textPrimary: "#111111",
        textSecondary: "#111111"
      },
      typography: {
        fontFamily: "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif",
        coverTopSize: 60,
        coverTopWeight: 500,
        coverTitleStartSize: 142,
        coverTitleMinSize: 82,
        coverTitleWeight: 700,
        coverSubtitleStartSize: 60,
        coverSubtitleMinSize: 46,
        coverSubtitleWeight: 500
      },
      layout: {
        cover: {
          topTextCenterX: 540,
          topTextY: 484,
          topTextWidth: 396,
          topTextLineHeight: 74,
          topTextMaxLines: 1,
          titleCenterX: 540,
          titleY: 772,
          titleWidth: 860,
          titleLineHeight: 124,
          titleMaxLines: 2,
          subtitleCenterX: 540,
          subtitleY: 1230,
          subtitleWidth: 720,
          subtitleLineHeight: 66,
          subtitleMaxLines: 1
        },
        page: {
          bodyX: 76,
          bodyY: 274,
          bodyWidth: 923,
          bodyMaxY: 1266,
          itemLineHeight: 70,
          itemGap: 22
        }
      }
    },
    zhishi: {
      id: "zhishi",
      name: "Zhishi",
      theme: "zhishi",
      coverSubtitle: "小说素材|干货分享|写作技巧",
      background: {
        styleKey: "zhishi",
        allowFallback: false
      },
      colors: {
        textPrimary: "#0A0A0A",
        textSecondary: "#101010"
      },
      typography: {
        fontFamily: "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif",
        coverTopSize: 66,
        coverTopWeight: 500,
        coverTitleStartSize: 140,
        coverTitleMinSize: 88,
        coverTitleWeight: 700,
        coverSubtitleStartSize: 60,
        coverSubtitleMinSize: 44,
        coverSubtitleWeight: 500
      },
      layout: {
        cover: {
          topTextX: 30,
          topTextY: 372,
          topTextWidth: 460,
          topTextLineHeight: 72,
          topTextMaxLines: 1,
          titleCenterX: 540,
          titleY: 772,
          titleWidth: 980,
          titleLineHeight: 124,
          titleMaxLines: 2,
          subtitleCenterX: 540,
          subtitleY: 1320,
          subtitleWidth: 760,
          subtitleLineHeight: 66,
          subtitleMaxLines: 1
        },
        page: {
          bodyX: 46,
          bodyY: 92,
          bodyWidth: 988,
          bodyMaxY: 1378,
          itemLineHeight: 64,
          itemGap: 24
        }
      }
    },
    xiangxiang: {
      id: "xiangxiang",
      name: "Xiangxiang",
      theme: "xiangxiang",
      coverSubtitle: "小说素材|干货分享",
      background: {
        styleKey: "xiangxiang",
        allowFallback: false
      },
      colors: {
        textPrimary: "#1C1C1C",
        textSecondary: "#211F1F"
      },
      typography: {
        fontFamily: "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif",
        coverTopSize: 58,
        coverTopWeight: 500,
        coverTitleStartSize: 122,
        coverTitleMinSize: 74,
        coverTitleWeight: 700,
        coverSubtitleStartSize: 52,
        coverSubtitleMinSize: 40,
        coverSubtitleWeight: 500,
        pageTitleSize: 60,
        pageTitleWeight: 700,
        bodySize: 45,
        bodyWeight: 500,
        leadWeight: 700
      },
      layout: {
        cover: {
          topTextX: 132,
          topTextY: 510,
          topTextWidth: 492,
          topTextLineHeight: 66,
          topTextMaxLines: 1,
          titleCenterX: 540,
          titleY: 736,
          titleWidth: 882,
          titleLineHeight: 108,
          titleMaxLines: 2,
          subtitleCenterX: 540,
          subtitleY: 1318,
          subtitleWidth: 450,
          subtitleLineHeight: 58,
          subtitleMaxLines: 1
        },
        page: {
          titleX: 83,
          titleY: 100,
          titleWidth: 909,
          titleLineHeight: 70,
          titleMaxLines: 2,
          bodyX: 83,
          bodyY: 182,
          bodyWidth: 909,
          bodyMaxY: 1000,
          itemLineHeight: 56,
          itemGap: 20
        }
      }
    }
  });

  var STYLE_ALIAS = Object.freeze({
    xiaoxing: "xiaoxing",
    xiao_xing: "xiaoxing",
    "xiaoxing-style": "xiaoxing",
    "小星": "xiaoxing",
    "小星风": "xiaoxing",
    "小星风格": "xiaoxing",
    xiaoxing_lab: "xiaoxing_lab",
    xiaoxinglab: "xiaoxing_lab",
    xiaoxingxiezuoshiyanshi: "xiaoxing_lab",
    "小星写作实验室": "xiaoxing_lab",
    rifu: "rifu",
    ri_fu: "rifu",
    "ri-fu": "rifu",
    "日富": "rifu",
    "日富一日": "rifu",
    banxia: "banxia",
    ban_xia: "banxia",
    "ban-xia": "banxia",
    "半夏": "banxia",
    "半夏416": "banxia",
    zhishi: "zhishi",
    zhi_shi: "zhishi",
    "zhi-shi": "zhishi",
    "芝士": "zhishi",
    xiangxiang: "xiangxiang",
    xiang_xiang: "xiangxiang",
    "xiang-xiang": "xiangxiang",
    "香香": "xiangxiang"
  });

  var imageCache = new Map();

  var refs = {
    jsonInput: document.getElementById("jsonInput"),
    jsonFiles: document.getElementById("jsonFiles"),
    jsonFolder: document.getElementById("jsonFolder"),
    doubaoApiKey: document.getElementById("doubaoApiKey"),
    doubaoBaseUrl: document.getElementById("doubaoBaseUrl"),
    doubaoModel: document.getElementById("doubaoModel"),
    doubaoTopic: document.getElementById("doubaoTopic"),
    doubaoPageCount: document.getElementById("doubaoPageCount"),
    doubaoLayoutStyle: document.getElementById("doubaoLayoutStyle"),
    doubaoGenerateBtn: document.getElementById("doubaoGenerateBtn"),
    fillSampleBtn: document.getElementById("fillSampleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    renderBtn: document.getElementById("renderBtn"),
    statusBox: document.getElementById("statusBox"),
    errorBox: document.getElementById("errorBox"),
    warningBox: document.getElementById("warningBox"),
    resultCount: document.getElementById("resultCount"),
    resultList: document.getElementById("resultList")
  };

  hydrateDoubaoConfig();
  bindEvents();
  maybeAutorunFromQuery();

  function bindEvents() {
    refs.fillSampleBtn.addEventListener("click", fillSample);
    refs.clearBtn.addEventListener("click", clearAll);
    refs.renderBtn.addEventListener("click", onRenderClick);
    refs.doubaoGenerateBtn.addEventListener("click", onDoubaoGenerateClick);
    bindStorageOnInput(refs.doubaoApiKey, STORAGE_KEYS.doubaoApiKey);
    bindStorageOnInput(refs.doubaoBaseUrl, STORAGE_KEYS.doubaoBaseUrl);
    bindStorageOnInput(refs.doubaoModel, STORAGE_KEYS.doubaoModel);
    bindStorageOnInput(refs.doubaoPageCount, STORAGE_KEYS.doubaoPageCount);
    bindStorageOnInput(refs.doubaoLayoutStyle, STORAGE_KEYS.doubaoLayoutStyle);
    refs.doubaoLayoutStyle.addEventListener("change", function () {
      onDoubaoLayoutStyleChange().catch(function (error) {
        showErrors(["切换排版风格失败：" + toErrorMessage(error)]);
        setStatus("切换排版风格失败。");
      });
    });
  }

  function hydrateDoubaoConfig() {
    hydrateDoubaoPageCountOptions();
    refs.doubaoApiKey.value = readStorage(STORAGE_KEYS.doubaoApiKey);
    refs.doubaoBaseUrl.value =
      readStorage(STORAGE_KEYS.doubaoBaseUrl) || DOUBAO_DEFAULT_BASE_URL;
    refs.doubaoModel.value = readStorage(STORAGE_KEYS.doubaoModel);
    var storedPageCount = sanitizeText(readStorage(STORAGE_KEYS.doubaoPageCount));
    var parsedPageCount = parseInt(storedPageCount, 10);
    refs.doubaoPageCount.value =
      !Number.isNaN(parsedPageCount) &&
      parsedPageCount >= DOUBAO_PAGE_COUNT_MIN &&
      parsedPageCount <= DOUBAO_PAGE_COUNT_MAX
        ? String(parsedPageCount)
        : String(DOUBAO_DEFAULT_PAGE_COUNT);
    refs.doubaoLayoutStyle.value = normalizeDoubaoLayoutStyle(
      readStorage(STORAGE_KEYS.doubaoLayoutStyle) || DOUBAO_DEFAULT_LAYOUT_STYLE
    );
  }

  function hydrateDoubaoPageCountOptions() {
    if (!refs.doubaoPageCount) {
      return;
    }

    var currentValue = sanitizeText(refs.doubaoPageCount.value);
    refs.doubaoPageCount.innerHTML = "";

    for (var count = DOUBAO_PAGE_COUNT_MIN; count <= DOUBAO_PAGE_COUNT_MAX; count += 1) {
      var option = document.createElement("option");
      option.value = String(count);
      option.textContent = count + " 页";
      refs.doubaoPageCount.appendChild(option);
    }

    var parsedCurrent = parseInt(currentValue, 10);
    if (
      !Number.isNaN(parsedCurrent) &&
      parsedCurrent >= DOUBAO_PAGE_COUNT_MIN &&
      parsedCurrent <= DOUBAO_PAGE_COUNT_MAX
    ) {
      refs.doubaoPageCount.value = String(parsedCurrent);
    } else {
      refs.doubaoPageCount.value = String(DOUBAO_DEFAULT_PAGE_COUNT);
    }
  }

  function bindStorageOnInput(inputEl, key) {
    if (!inputEl) {
      return;
    }

    var save = function () {
      writeStorage(key, inputEl.value);
    };

    inputEl.addEventListener("input", save);
    inputEl.addEventListener("change", save);
  }

  function fillSample() {
    var sample = {
      style: "xiaoxing_lab",
      content_style: "general",
      cover_top_text: "可写进小说里的",
      cover_title: "虐哭台词",
      cover_subtitle: "小说素材、干货分享",
      pages: [
        {
          type: "list",
          title: "角色设定方向",
          items: [
            "迷糊可爱天然呆，总是迷迷糊糊，沉浸在自己的世界里。",
            "善良治愈小天使，很爱笑，心地善良，主动帮助别人。",
            "天生反骨小恶魔，反社会人格，做事全凭心情。"
          ]
        },
        {
          type: "tag",
          title: "高频情绪标签",
          items: [
            "【绝望感】我到底做错了什么？",
            "【隐忍式】再忍忍就好了。",
            "【清醒式】我没有错。"
          ]
        },
        {
          type: "compare",
          title: "普通写法 vs 优化写法",
          items: [
            {
              normal: "她被霸凌后很害怕，浑身都在发抖。",
              better: "她后背紧贴冰冷墙壁，肩膀控制不住地打颤。"
            },
            {
              normal: "霸凌者很嚣张，围着他说难听的话。",
              better: "几个人把他堵在墙角，污言秽语一句比一句刺耳。"
            }
          ]
        }
      ]
    };

    refs.jsonInput.value = JSON.stringify(sample, null, 2);
    clearMessages();
    setStatus("示例已填充：小星写作实验室样式。点击“开始渲染”即可出图。");
  }

  function clearAll() {
    refs.jsonInput.value = "";
    refs.jsonFiles.value = "";
    refs.jsonFolder.value = "";
    refs.resultList.innerHTML = "";
    refs.resultCount.textContent = "0 组";
    clearMessages();
    setStatus("已清空输入与结果。");
  }

  function maybeAutorunFromQuery() {
    if (typeof window === "undefined" || !window.location || !window.location.search) {
      return;
    }

    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (error) {
      return;
    }

    if (params.get("xhs_autorun") !== "1") {
      return;
    }

    var input = params.get("xhs_input");
    var autoDownload = params.get("xhs_autodownload") === "1";
    var autoDownloadIndex = parseInt(params.get("xhs_autodownload_index") || "", 10);
    if (!sanitizeText(input)) {
      setStatus("检测到 xhs_autorun，但缺少 xhs_input。");
      document.body.setAttribute("data-xhs-autorun", "error");
      document.body.setAttribute("data-xhs-autorun-error", "missing-input");
      return;
    }

    refs.jsonInput.value = input;
    setStatus("检测到 xhs_autorun，正在自动渲染…");
    Promise.resolve()
      .then(function () {
        return onRenderClick();
      })
      .then(function () {
        document.body.setAttribute(
          "data-xhs-image-count",
          String((refs.resultList.querySelectorAll("img") || []).length)
        );
        emitAutorunConsoleExport(params);
        if (autoDownload) {
          triggerAutorunDownloads(Number.isNaN(autoDownloadIndex) ? null : autoDownloadIndex);
        }
        document.body.setAttribute("data-xhs-autorun", "done");
      })
      .catch(function (error) {
        document.body.setAttribute("data-xhs-autorun", "error");
        document.body.setAttribute("data-xhs-autorun-error", toErrorMessage(error));
      });
  }

  function triggerAutorunDownloads(autoDownloadIndex) {
    if (typeof autoDownloadIndex === "number" && autoDownloadIndex > 0) {
      var oneButtons = refs.resultList.querySelectorAll(".thumb figcaption .btn.btn-ghost");
      var target = oneButtons[autoDownloadIndex - 1];
      document.body.setAttribute("data-xhs-autodownload-index", String(autoDownloadIndex));
      document.body.setAttribute("data-xhs-autodownload-count", String(oneButtons.length));
      if (target) {
        var labelNode = target.parentElement && target.parentElement.querySelector("span");
        var figureNode = target.parentElement && target.parentElement.parentElement;
        var imgNode = figureNode && figureNode.querySelector("img");
        var fileName = sanitizeText(target.getAttribute("data-file-name"));
        setStatus(
          "xhs_autodownload_index=" +
            autoDownloadIndex +
            " / total=" +
            oneButtons.length +
            (labelNode ? " / " + labelNode.textContent : "") +
            (fileName ? " / " + fileName : "")
        );
        if (fileName && imgNode && /^data:image\//i.test(String(imgNode.src || ""))) {
          downloadDataUrl(imgNode.src, fileName);
        } else {
          target.click();
        }
      }
      return;
    }

    var downloadButtons = refs.resultList.querySelectorAll(".group-header .btn.btn-primary");
    for (var i = 0; i < downloadButtons.length; i += 1) {
      (function (index) {
        setTimeout(function () {
          downloadButtons[index].click();
        }, index * 1200);
      })(i);
    }
  }

  function emitAutorunConsoleExport(params) {
    if (!params || params.get("xhs_export_console") !== "1") {
      return;
    }

    var figures = refs.resultList.querySelectorAll(".thumb");
    var chunkSize = 30;
    var exported = 0;

    for (var i = 0; i < figures.length; i += 1) {
      var figure = figures[i];
      var imgNode = figure.querySelector("img");
      var buttonNode = figure.querySelector(".btn.btn-ghost");
      var dataUrl = sanitizeText(imgNode && imgNode.src);
      var fileName =
        sanitizeText(buttonNode && buttonNode.getAttribute("data-file-name")) ||
        "xhs_" + String(i + 1).padStart(2, "0") + ".jpg";

      if (!/^data:image\//i.test(dataUrl)) {
        continue;
      }

      var commaIndex = dataUrl.indexOf(",");
      if (commaIndex <= 0) {
        continue;
      }

      var mimeMeta = dataUrl.slice(5, commaIndex);
      var base64 = dataUrl.slice(commaIndex + 1);
      var serial = i + 1;
      var chunkCount = Math.max(1, Math.ceil(base64.length / chunkSize));

      console.log(
        "XHS_EXPORT_BEGIN|" +
          serial +
          "|" +
          fileName +
          "|" +
          mimeMeta +
          "|" +
          base64.length +
          "|" +
          chunkCount
      );

      for (var start = 0, chunkNo = 1; start < base64.length; start += chunkSize, chunkNo += 1) {
        console.log(
          "XHS_EXPORT_CHUNK|" +
            serial +
            "|" +
            chunkNo +
            "|" +
            base64.slice(start, start + chunkSize)
        );
      }

      console.log("XHS_EXPORT_END|" + serial);
      exported += 1;
    }

    console.log("XHS_EXPORT_DONE|" + exported);
  }

  async function onDoubaoLayoutStyleChange() {
    var selectedStyle = normalizeDoubaoLayoutStyle(refs.doubaoLayoutStyle.value);
    refs.doubaoLayoutStyle.value = selectedStyle;
    writeStorage(STORAGE_KEYS.doubaoLayoutStyle, selectedStyle);

    var syncResult = syncJsonInputLayoutStyle(selectedStyle);
    if (syncResult.error) {
      showWarnings([
        "排版风格已切换为 " + selectedStyle + "，但当前输入文本无法自动同步 style：" + syncResult.error
      ]);
      setStatus("排版风格已切换为 " + selectedStyle + "。");
      return;
    }

    if (!syncResult.applied) {
      setStatus("排版风格已切换为 " + selectedStyle + "。");
      return;
    }

    if (refs.resultList.children.length > 0) {
      setStatus("已切换为 " + selectedStyle + "，正在自动重渲染预览...");
      await onRenderClick();
      return;
    }

    setStatus(
      "已将输入 JSON 的 style 同步为 " +
        selectedStyle +
        "（更新 " +
        syncResult.changedCount +
        " 组）。点击“开始渲染”即可出图。"
    );
  }

  function syncJsonInputLayoutStyle(layoutStyle) {
    var textInput = sanitizeText(refs.jsonInput.value);
    if (!textInput) {
      return { applied: false, changedCount: 0 };
    }

    var parsedPayloads;
    try {
      parsedPayloads = parseJsonPayloadText(textInput, "粘贴内容");
    } catch (error) {
      return { applied: false, changedCount: 0, error: toErrorMessage(error) };
    }

    if (!Array.isArray(parsedPayloads) || parsedPayloads.length === 0) {
      return { applied: false, changedCount: 0 };
    }

    var changedCount = 0;
    var updatedPayloads = parsedPayloads.map(function (entry) {
      var value = entry && entry.value;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }
      if (!Array.isArray(value.pages)) {
        return value;
      }

      var currentStyle = mapStyleAlias(value.style) || sanitizeText(value.style);
      if (currentStyle === layoutStyle) {
        return value;
      }

      changedCount += 1;
      var nextValue = Object.assign({}, value);
      nextValue.style = layoutStyle;
      return nextValue;
    });

    if (changedCount === 0) {
      return { applied: false, changedCount: 0 };
    }

    refs.jsonInput.value = JSON.stringify(
      updatedPayloads.length === 1 ? updatedPayloads[0] : updatedPayloads,
      null,
      2
    );
    return { applied: true, changedCount: changedCount };
  }

  async function onDoubaoGenerateClick() {
    clearMessages();

    var apiKey = sanitizeText(refs.doubaoApiKey.value);
    var baseUrl = sanitizeText(refs.doubaoBaseUrl.value) || DOUBAO_DEFAULT_BASE_URL;
    var model = sanitizeText(refs.doubaoModel.value);
    var topicInput = String(refs.doubaoTopic.value || "");
    var pageCountInput = sanitizeText(refs.doubaoPageCount.value);
    var layoutStyleInput = normalizeDoubaoLayoutStyle(refs.doubaoLayoutStyle.value);
    var promptInput = parseDoubaoTopicInput(topicInput, pageCountInput);

    var missing = [];
    if (!apiKey) {
      missing.push("豆包 API Key");
    }
    if (!model) {
      missing.push("豆包 模型/接入点ID");
    }
    if (promptInput.topics.length === 0) {
      missing.push("主题");
    }

    if (missing.length > 0) {
      showErrors(["请先填写：" + missing.join("、") + "。"]);
      setStatus("主题生成失败：存在必填项缺失。");
      return;
    }

    refs.doubaoBaseUrl.value = baseUrl;
    refs.doubaoLayoutStyle.value = layoutStyleInput;
    writeStorage(STORAGE_KEYS.doubaoApiKey, apiKey);
    writeStorage(STORAGE_KEYS.doubaoBaseUrl, baseUrl);
    writeStorage(STORAGE_KEYS.doubaoModel, model);
    writeStorage(STORAGE_KEYS.doubaoPageCount, pageCountInput || String(DOUBAO_DEFAULT_PAGE_COUNT));
    writeStorage(STORAGE_KEYS.doubaoLayoutStyle, layoutStyleInput);

    var originalBtnText = refs.doubaoGenerateBtn.textContent || DOUBAO_GENERATE_BUTTON_TEXT;
    refs.doubaoGenerateBtn.disabled = true;
    refs.doubaoGenerateBtn.textContent = "生成中（0/" + promptInput.topics.length + "）...";

    try {
      setStatus("正在请求豆包生成 JSON...");
      var generationResult = await handleGenerateFromTopic({
        provider: "doubao",
        apiKey: apiKey,
        baseUrl: baseUrl,
        model: model,
        rawTopicInput: topicInput,
        selectedPageCount: pageCountInput,
        selectedLayoutStyle: layoutStyleInput,
        temperature: 0.6,
        onProgress: function (current, total) {
          refs.doubaoGenerateBtn.textContent = "生成中（" + current + "/" + total + "）...";
          setStatus("正在生成第 " + current + "/" + total + " 组...");
        }
      });

      if (generationResult.successItems.length === 0) {
        var allFailedWarnings = generationResult.failureItems.map(function (item) {
          return "第 " + item.index + " 组「" + item.topic + "」失败：" + item.message;
        });
        showErrors(
          ["未生成可用 JSON：成功 0 组，失败 " + generationResult.failureItems.length + " 组。"].concat(
            allFailedWarnings
          )
        );
        setStatus("豆包生成失败：成功 0 组，失败 " + generationResult.failureItems.length + " 组。");
        return;
      }

      var outputPayload =
        generationResult.successItems.length === 1
          ? generationResult.successItems[0].payload
          : generationResult.successItems.map(function (item) {
              return item.payload;
            });
      refs.jsonInput.value = JSON.stringify(outputPayload, null, 2);

      var warningItems = [];
      if (generationResult.repairWarnings.length > 0) {
        warningItems = warningItems.concat(generationResult.repairWarnings);
      }
      if (generationResult.failureItems.length > 0) {
        warningItems.push(
          "批量生成完成：成功 " +
            generationResult.successItems.length +
            " 组，失败 " +
            generationResult.failureItems.length +
            " 组。"
        );
        warningItems = warningItems.concat(
          generationResult.failureItems.map(function (item) {
            return "第 " + item.index + " 组「" + item.topic + "」失败：" + item.message;
          })
        );
      }
      if (warningItems.length > 0) {
        showWarnings(warningItems);
      }

      if (generationResult.failureItems.length > 0) {
        setStatus(
          "豆包批量生成完成：成功 " +
            generationResult.successItems.length +
            " 组，失败 " +
            generationResult.failureItems.length +
            " 组。"
        );
      } else {
        setStatus(
          "豆包生成成功：共 " +
            generationResult.successItems.length +
            " 组，JSON 已写入输入框，可直接点击“开始渲染”。"
        );
      }
    } catch (error) {
      showErrors(["豆包生成失败：" + toErrorMessage(error)]);
      setStatus("豆包生成失败。");
    } finally {
      refs.doubaoGenerateBtn.disabled = false;
      refs.doubaoGenerateBtn.textContent = originalBtnText;
    }
  }

  async function handleGenerateFromTopic(options) {
    var parsedInput = parseDoubaoTopicInput(options.rawTopicInput, options.selectedPageCount);
    var selectedLayoutStyle = normalizeDoubaoLayoutStyle(options.selectedLayoutStyle);
    var topics = parsedInput.topics;
    var successItems = [];
    var failureItems = [];
    var repairWarnings = [];

    for (var i = 0; i < topics.length; i += 1) {
      var topic = topics[i];
      if (typeof options.onProgress === "function") {
        options.onProgress(i + 1, topics.length, topic);
      }

      try {
        var generatedJson = await requestJsonByProvider(options.provider, {
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          model: options.model,
          topic: topic,
          styleLabel: parsedInput.styleLabel,
          layoutStyle: selectedLayoutStyle,
          pageCount: parsedInput.pageCount,
          temperature: options.temperature
        });
        var repairNotes = [];
        var repairedJson = repairGeneratedPayload(
          generatedJson,
          topic,
          parsedInput.styleLabel,
          selectedLayoutStyle,
          parsedInput.pageCount,
          repairNotes
        );

        try {
          normalizeGroup(repairedJson, "主题生成结果#" + (i + 1));
        } catch (error) {
          throw new Error("JSON 协议校验失败：" + toErrorMessage(error));
        }

        if (repairNotes.length > 0) {
          repairWarnings.push("主题「" + topic + "」已自动修复：" + repairNotes.join("；"));
        }

        successItems.push({
          index: i + 1,
          topic: topic,
          payload: repairedJson
        });
      } catch (error) {
        failureItems.push({
          index: i + 1,
          topic: topic,
          message: toErrorMessage(error)
        });
      }
    }

    return {
      successItems: successItems,
      failureItems: failureItems,
      repairWarnings: repairWarnings
    };
  }

  async function requestJsonByProvider(provider, requestOptions) {
    if (provider === "doubao") {
      return requestDoubaoJson(requestOptions);
    }

    if (provider === "gemini" && typeof requestGeminiJson === "function") {
      return requestGeminiJson(requestOptions);
    }

    if (provider === "ollama" && typeof requestOllamaJson === "function") {
      return requestOllamaJson(requestOptions);
    }

    throw new Error("未找到可用的生成器：" + provider + "。");
  }

  async function requestDoubaoJson(options) {
    var endpoint = normalizeBaseUrl(options.baseUrl) + "/chat/completions";
    var response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + options.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: "system",
            content: DOUBAO_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildDoubaoUserPrompt(
              options.topic,
              options.styleLabel,
              options.pageCount,
              options.layoutStyle
            )
          }
        ],
        temperature: options.temperature
      })
    });

    var responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        "请求失败（HTTP " +
          response.status +
          "）： " +
          summarizeErrorText(responseText)
      );
    }

    var responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      throw new Error("豆包接口返回不是合法 JSON：" + toErrorMessage(error));
    }

    var choices = responseData && Array.isArray(responseData.choices) ? responseData.choices : [];
    var firstChoice = choices[0];
    var message = firstChoice && firstChoice.message ? firstChoice.message : null;
    var modelContent = message ? message.content : null;

    if (modelContent === null || typeof modelContent === "undefined") {
      throw new Error("接口返回缺少 choices[0].message.content。");
    }

    return parseGeneratedJsonText(modelContent);
  }

  function buildDoubaoUserPrompt(topic, styleLabel, pageCount, layoutStyle) {
    var safeTopic = sanitizeText(topic) || "写作素材";
    var safeStyleLabel = sanitizeText(styleLabel) || "通用";
    var safePageCount = normalizeRequestedPageCount(pageCount);
    var safeLayoutStyle = normalizeDoubaoLayoutStyle(layoutStyle);

    return DOUBAO_USER_PROMPT_TEMPLATE.split("{topic}")
      .join(safeTopic)
      .split("{style_label}")
      .join(safeStyleLabel)
      .split("{layout_style}")
      .join(safeLayoutStyle)
      .split("{page_count}")
      .join(String(safePageCount));
  }

  function repairGeneratedPayload(
    rawPayload,
    topic,
    styleLabel,
    selectedLayoutStyle,
    pageCount,
    notes
  ) {
    var safeTopic = sanitizeText(topic) || "主题内容";
    var safeStyleLabel = sanitizeText(styleLabel) || "通用";
    var safeLayoutStyle = normalizeDoubaoLayoutStyle(selectedLayoutStyle);
    var safePageCount = normalizeRequestedPageCount(pageCount);
    var raw =
      rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload : {};
    var rawStyle = mapStyleAlias(sanitizeText(raw.style));
    var rawContentStyle = sanitizeText(raw.content_style || raw.contentStyle);
    var finalStyle = safeLayoutStyle;
    var output = {
      style: finalStyle,
      content_style: rawContentStyle || deriveContentStyleSlug(safeStyleLabel),
      cover_top_text: sanitizeText(raw.cover_top_text || raw.coverTopText || safeTopic),
      cover_title: sanitizeText(raw.cover_title || raw.coverTitle || safeTopic),
      cover_subtitle: "小说素材、干货分享",
      pages: []
    };

    if (!rawStyle) {
      pushUniqueNote(notes, "style 缺失或无效，已修正为 " + safeLayoutStyle + "。");
    } else if (rawStyle !== safeLayoutStyle) {
      pushUniqueNote(
        notes,
        "style 为 " + rawStyle + "，与选择的排版风格不一致，已修正为 " + safeLayoutStyle + "。"
      );
    }
    if (!sanitizeText(raw.cover_title || raw.coverTitle)) {
      pushUniqueNote(notes, "cover_title 缺失，已按主题自动补全。");
    }
    if (!rawContentStyle) {
      pushUniqueNote(
        notes,
        "content_style 缺失，已按风格「" +
          safeStyleLabel +
          "」修正为 " +
          output.content_style +
          "。"
      );
    }
    if (sanitizeText(raw.cover_subtitle || raw.coverSubtitle) !== "小说素材、干货分享") {
      pushUniqueNote(notes, "cover_subtitle 已固定为「小说素材、干货分享」。");
    }

    var rawPages = Array.isArray(raw.pages) ? raw.pages : [];
    if (rawPages.length === 0) {
      pushUniqueNote(notes, "pages 缺失，已自动补齐到 " + safePageCount + " 页。");
      rawPages = [];
    }

    var repairedPages = rawPages.map(function (pageRaw, idx) {
      return repairGeneratedPage(pageRaw, idx + 1, safeTopic, notes);
    });

    if (repairedPages.length > safePageCount) {
      pushUniqueNote(
        notes,
        "pages 数量为 " +
          repairedPages.length +
          "，超过所选页数 " +
          safePageCount +
          "，已按所选页数裁剪。"
      );
      repairedPages = repairedPages.slice(0, safePageCount);
    } else if (repairedPages.length < safePageCount) {
      pushUniqueNote(
        notes,
        "pages 数量为 " +
          repairedPages.length +
          "，少于所选页数 " +
          safePageCount +
          "，已自动补齐。"
      );
    }

    while (repairedPages.length < safePageCount) {
      repairedPages.push(createGeneratedFillerPage(repairedPages.length + 1, safeTopic));
    }

    output.pages = repairedPages;

    return output;
  }

  function repairGeneratedPage(pageRaw, pageNumber, topic, notes) {
    var raw = pageRaw && typeof pageRaw === "object" && !Array.isArray(pageRaw) ? pageRaw : {};
    var title = sanitizeText(raw.title || raw.page_title || "第 " + pageNumber + " 页");
    var text = sanitizeText(raw.content || raw.text || raw.desc || raw.body);
    var type = mapPageType(raw.type || raw.page_type || "auto") || "auto";
    var items = toStringArray(raw.items || raw.list || raw.points || raw.bullets);
    var tags = toStringArray(raw.tags || raw.keywords);
    var comparePairs = toComparePairs(
      raw.compare_items || raw.compareItems || raw.pairs || raw.compare || raw.items
    );
    var left = toStringArray(raw.left || raw.left_items || raw.pros);
    var right = toStringArray(raw.right || raw.right_items || raw.cons);

    if (comparePairs.length === 0 && (left.length > 0 || right.length > 0)) {
      comparePairs = toComparePairsFromLeftRight(left, right);
    }

    if (type === "list") {
      if (items.length === 0) {
        if (text) {
          items = [text];
        } else {
          items = [title + "：围绕「" + topic + "」补充要点内容。"];
        }
        pushUniqueNote(notes, "第 " + pageNumber + " 页 list 内容为空，已自动补全 items。");
      }
      return {
        type: "list",
        title: title,
        items: items
      };
    }

    if (type === "tag") {
      if (tags.length === 0) {
        tags = items.length > 0 ? items.slice() : [];
      }
      if (tags.length === 0) {
        if (text) {
          tags = [text];
        } else {
          tags = ["#" + topic, "#" + title];
        }
        pushUniqueNote(notes, "第 " + pageNumber + " 页 tag 内容为空，已自动补全 items。");
      }
      return {
        type: "tag",
        title: title,
        items: tags
      };
    }

    if (type === "compare") {
      if (comparePairs.length === 0) {
        comparePairs = [
          {
            normal: "普通写法：围绕「" + topic + "」的基础表达。",
            better: "优化写法：围绕「" + topic + "」的更具画面感表达。"
          }
        ];
        pushUniqueNote(notes, "第 " + pageNumber + " 页 compare 内容为空，已自动补全 normal/better。");
      }
      return {
        type: "compare",
        title: title,
        items: comparePairs
      };
    }

    if (!text && items.length === 0 && tags.length === 0 && comparePairs.length === 0) {
      text = title + "：围绕「" + topic + "」补充可渲染正文内容。";
      pushUniqueNote(notes, "第 " + pageNumber + " 页 auto 无内容，已自动补全 text。");
    }

    return {
      type: "auto",
      title: title,
      text: text
    };
  }

  function createGeneratedFillerPage(pageNumber, topic) {
    return {
      type: "list",
      title: "补充素材 " + pageNumber,
      items: ["围绕「" + topic + "」补充可直接使用的写作素材。"]
    };
  }

  function parseDoubaoTopicInput(rawInput, selectedPageCount) {
    var text = String(rawInput || "").trim();
    var lines = text ? text.split(/\r?\n/) : [];
    var styleLabel = "";
    var pageCountRaw = "";

    for (var i = 0; i < lines.length; i += 1) {
      var line = sanitizeText(lines[i]);
      if (!line) {
        continue;
      }

      if (!styleLabel) {
        styleLabel = extractLabeledValue(line, "风格");
      }

      if (!pageCountRaw) {
        pageCountRaw = extractLabeledValue(line, "页数");
      }
    }

    var topics = parseTopicBatchInput(text);
    if (!styleLabel) {
      styleLabel = "通用";
    }
    var pageCount = selectedPageCount
      ? normalizeRequestedPageCount(selectedPageCount)
      : normalizeRequestedPageCount(pageCountRaw);

    return {
      topic: topics[0] || "",
      topics: topics,
      styleLabel: styleLabel,
      pageCount: pageCount
    };
  }

  function parseTopicBatchInput(raw) {
    var lines = String(raw || "").split(/\r?\n/);
    var topics = [];

    for (var i = 0; i < lines.length; i += 1) {
      var line = sanitizeText(lines[i]);
      if (!line) {
        continue;
      }

      line = line.replace(/^\s*(?:[-*•]\s+|\d+\s*(?:[\.、:：)\]）])\s*)/, "");

      var topicFromLabel = extractLabeledValue(line, "主题");
      if (topicFromLabel) {
        topics.push(topicFromLabel);
        continue;
      }

      if (extractLabeledValue(line, "风格")) {
        continue;
      }

      if (extractLabeledValue(line, "页数")) {
        continue;
      }

      line = sanitizeText(line);
      if (!line) {
        continue;
      }

      topics.push(line);
    }

    return topics;
  }

  function extractLabeledValue(line, label) {
    var text = sanitizeText(line);
    if (!text) {
      return "";
    }

    var escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = text.match(new RegExp("^" + escapedLabel + "\\s*[:：]\\s*(.+)$", "i"));
    return match ? sanitizeText(match[1]) : "";
  }

  function normalizeRequestedPageCount(input) {
    var text = sanitizeText(input);
    var numberMatch = text.match(/\d+/);
    if (!numberMatch) {
      return DOUBAO_DEFAULT_PAGE_COUNT;
    }

    var value = parseInt(numberMatch[0], 10);
    if (Number.isNaN(value) || value <= 0) {
      return DOUBAO_DEFAULT_PAGE_COUNT;
    }

    return Math.min(DOUBAO_PAGE_COUNT_MAX, Math.max(DOUBAO_PAGE_COUNT_MIN, value));
  }

  function deriveContentStyleSlug(styleLabel) {
    var raw = sanitizeText(styleLabel);
    if (!raw) {
      return "general";
    }

    var mapped = STYLE_LABEL_TO_SLUG[raw] || STYLE_LABEL_TO_SLUG[raw.toLowerCase()];
    if (mapped) {
      return mapped;
    }

    var asciiSlug = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (asciiSlug) {
      return asciiSlug;
    }

    return "general";
  }

  function pushUniqueNote(notes, text) {
    if (!Array.isArray(notes)) {
      return;
    }
    if (notes.indexOf(text) >= 0) {
      return;
    }
    notes.push(text);
  }

  function parseGeneratedJsonText(content) {
    var contentText = normalizeMessageContent(content);
    var candidates = collectJsonCandidates(contentText);

    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var parsed = JSON.parse(candidates[i]);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          continue;
        }
        return parsed;
      } catch (error) {
        continue;
      }
    }

    throw new Error("返回内容不是合法 JSON。");
  }

  function normalizeMessageContent(content) {
    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map(function (part) {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .join("\n")
        .trim();
    }

    if (content && typeof content.text === "string") {
      return content.text.trim();
    }

    return String(content || "").trim();
  }

  function collectJsonCandidates(rawText) {
    var text = String(rawText || "").trim();
    var candidates = [];

    pushCandidate(candidates, text);

    var fenceStripped = stripCodeFence(text);
    pushCandidate(candidates, fenceStripped);

    pushCandidate(candidates, extractFirstJsonSegment(text));
    pushCandidate(candidates, extractFirstJsonSegment(fenceStripped));

    return candidates;
  }

  function pushCandidate(candidates, value) {
    var text = String(value || "").trim();
    if (!text) {
      return;
    }
    if (candidates.indexOf(text) >= 0) {
      return;
    }
    candidates.push(text);
  }

  function stripCodeFence(text) {
    var match = String(text || "")
      .trim()
      .match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : String(text || "").trim();
  }

  function extractFirstJsonSegment(rawText) {
    var text = String(rawText || "");
    var start = -1;

    for (var i = 0; i < text.length; i += 1) {
      if (text[i] === "{" || text[i] === "[") {
        start = i;
        break;
      }
    }

    if (start < 0) {
      return "";
    }

    var stack = [];
    var inString = false;
    var quote = "";
    var escaped = false;

    for (var j = start; j < text.length; j += 1) {
      var c = text[j];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === quote) {
          inString = false;
          quote = "";
        }
        continue;
      }

      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        continue;
      }

      if (c === "{" || c === "[") {
        stack.push(c);
        continue;
      }

      if (c === "}" || c === "]") {
        if (stack.length === 0) {
          return "";
        }

        var expected = c === "}" ? "{" : "[";
        if (stack[stack.length - 1] !== expected) {
          return "";
        }

        stack.pop();
        if (stack.length === 0) {
          return text.slice(start, j + 1).trim();
        }
      }
    }

    return "";
  }

  function summarizeErrorText(text) {
    var content = String(text || "").trim();
    if (!content) {
      return "无详细信息。";
    }

    if (content.length > 220) {
      return content.slice(0, 220) + "...";
    }

    return content;
  }

  function normalizeBaseUrl(input) {
    return String(input || DOUBAO_DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, "");
  }

  async function onRenderClick() {
    clearMessages();
    refs.resultList.innerHTML = "";
    refs.resultCount.textContent = "0 组";
    refs.renderBtn.disabled = true;

    try {
      setStatus("正在解析输入...");
      var collected = await collectAndValidateGroups();

      if (collected.errors.length > 0) {
        showErrors(collected.errors);
        setStatus("解析失败，请先修正错误。");
        return;
      }

      if (collected.groups.length === 0) {
        showErrors(["没有可渲染内容。请粘贴文本，或上传 JSON/TXT 文件。"]);
        setStatus("没有可渲染数据。");
        return;
      }

      var warnings = new Set(collected.warnings);
      setStatus("正在渲染并导出 JPEG...");

      var allResults = [];
      for (var i = 0; i < collected.groups.length; i += 1) {
        allResults.push(await renderOneGroup(collected.groups[i], i, warnings));
      }

      renderResults(allResults);
      refs.resultCount.textContent = String(allResults.length) + " 组";

      if (warnings.size > 0) {
        showWarnings(Array.from(warnings));
      }
      setStatus("渲染完成：共 " + allResults.length + " 组。");
    } catch (error) {
      showErrors(["渲染失败：" + toErrorMessage(error)]);
      setStatus("渲染失败。");
    } finally {
      refs.renderBtn.disabled = false;
    }
  }
  async function collectAndValidateGroups() {
    var groups = [];
    var warnings = [];
    var errors = [];
    var payloads = [];

    var textInput = refs.jsonInput.value.trim();
    if (textInput.length > 0) {
      try {
        payloads = payloads.concat(parseJsonPayloadText(textInput, "粘贴内容"));
      } catch (error) {
        errors.push("粘贴内容解析失败：" + toErrorMessage(error));
      }
    }

    var files = getUploadedInputFiles();
    if (files.length > 0) {
      var fileResults = await Promise.all(
        files.map(async function (file) {
          try {
            var source = file.webkitRelativePath || file.name;
            var text = await file.text();
            return { payloads: parseJsonPayloadText(text, source), errors: [] };
          } catch (error) {
            return {
              payloads: [],
              errors: [
                (file.webkitRelativePath || file.name) + " 解析失败：" + toErrorMessage(error)
              ]
            };
          }
        })
      );

      for (var i = 0; i < fileResults.length; i += 1) {
        payloads = payloads.concat(fileResults[i].payloads);
        errors = errors.concat(fileResults[i].errors);
      }
    }

    if (textInput.length === 0 && files.length === 0) {
      errors.push("未检测到输入。请粘贴文本，或上传 JSON/TXT 文件（支持文件夹上传）。");
    }

    for (var j = 0; j < payloads.length; j += 1) {
      try {
        groups.push(normalizeGroup(payloads[j].value, payloads[j].source));
      } catch (error) {
        errors.push(payloads[j].source + " 校验失败：" + toErrorMessage(error));
      }
    }

    return {
      groups: groups,
      warnings: warnings,
      errors: errors
    };
  }

  function parseJsonPayloadText(text, source) {
    var cleaned = String(text || "").trim();
    if (!cleaned) {
      return [];
    }

    try {
      return parseOnePayload(cleaned, source);
    } catch (mainError) {
      var chunks = cleaned
        .split(/\n\s*---+\s*\n/g)
        .map(function (chunk) {
          return chunk.trim();
        })
        .filter(Boolean);

      if (chunks.length > 1) {
        var merged = [];
        for (var i = 0; i < chunks.length; i += 1) {
          try {
            merged = merged.concat(parseOnePayload(chunks[i], source + "#片段" + (i + 1)));
          } catch (chunkError) {
            throw new Error("第 " + (i + 1) + " 个片段错误：" + toErrorMessage(chunkError));
          }
        }
        return merged;
      }

      throw mainError;
    }
  }

  function parseOnePayload(text, source) {
    try {
      return normalizeParsedPayload(JSON.parse(text), source);
    } catch (jsonError) {
      try {
        var relaxed = parseRelaxedNotation(text);
        return normalizeParsedPayload(relaxed, source);
      } catch (relaxedError) {
        throw new Error(
          "既不是标准 JSON，也不是宽松 JSON。JSON错误：" +
            toErrorMessage(jsonError) +
            "；宽松解析错误：" +
            toErrorMessage(relaxedError)
        );
      }
    }
  }

  function parseRelaxedNotation(text) {
    var parser = createRelaxedParser(text);
    var result = parser.parseValue();
    parser.skipWhitespace();
    if (!parser.isEnd()) {
      throw new Error("存在未解析内容，从位置 " + parser.index + " 开始。");
    }
    return result;
  }

  function createRelaxedParser(raw) {
    var input = String(raw || "");
    var state = {
      index: 0,
      isEnd: function () {
        return this.index >= input.length;
      },
      peek: function () {
        return input[this.index];
      },
      skipWhitespace: function () {
        while (!this.isEnd()) {
          var c = this.peek();
          if (c === " " || c === "\n" || c === "\r" || c === "\t") {
            this.index += 1;
          } else {
            break;
          }
        }
      },
      parseValue: function () {
        this.skipWhitespace();
        if (this.isEnd()) {
          throw new Error("意外结束。");
        }

        var c = this.peek();
        if (c === "{") {
          return this.parseObject();
        }
        if (c === "[") {
          return this.parseArray();
        }
        if (c === '"' || c === "'") {
          return this.parseQuotedString();
        }
        return this.parseBareValue();
      },
      parseObject: function () {
        var obj = {};
        this.expect("{");
        this.skipWhitespace();

        if (this.peek() === "}") {
          this.index += 1;
          return obj;
        }

        while (!this.isEnd()) {
          this.skipWhitespace();
          if (this.peek() === "}") {
            this.index += 1;
            break;
          }

          var key = this.parseKey();
          this.skipWhitespace();

          if (this.peek() === ":") {
            this.index += 1;
          }

          var value = this.parseValue();
          obj[key] = value;

          this.skipWhitespace();
          if (this.peek() === ",") {
            this.index += 1;
            continue;
          }
          if (this.peek() === "}") {
            this.index += 1;
            break;
          }
        }

        return obj;
      },
      parseArray: function () {
        var arr = [];
        this.expect("[");
        this.skipWhitespace();

        if (this.peek() === "]") {
          this.index += 1;
          return arr;
        }

        while (!this.isEnd()) {
          var value = this.parseValue();
          arr.push(value);

          this.skipWhitespace();
          if (this.peek() === ",") {
            this.index += 1;
            this.skipWhitespace();
            continue;
          }
          if (this.peek() === "]") {
            this.index += 1;
            break;
          }
        }

        return arr;
      },
      parseKey: function () {
        this.skipWhitespace();
        if (this.peek() === '"' || this.peek() === "'") {
          return this.parseQuotedString();
        }

        var start = this.index;
        while (!this.isEnd()) {
          var c = this.peek();
          if (
            c === " " ||
            c === "\n" ||
            c === "\r" ||
            c === "\t" ||
            c === ":" ||
            c === "," ||
            c === "{" ||
            c === "}" ||
            c === "[" ||
            c === "]"
          ) {
            break;
          }
          this.index += 1;
        }

        var key = input.slice(start, this.index).trim();
        if (!key) {
          throw new Error("对象 key 为空，位置 " + start);
        }
        return key;
      },
      parseQuotedString: function () {
        var quote = this.peek();
        this.index += 1;
        var result = "";

        while (!this.isEnd()) {
          var c = this.peek();
          this.index += 1;

          if (c === "\\") {
            if (this.isEnd()) {
              break;
            }
            var next = this.peek();
            this.index += 1;
            result += next;
            continue;
          }

          if (c === quote) {
            return result;
          }

          result += c;
        }

        throw new Error("字符串未闭合。");
      },
      parseBareValue: function () {
        var start = this.index;
        while (!this.isEnd()) {
          var c = this.peek();
          if (c === "," || c === "}" || c === "]") {
            break;
          }
          this.index += 1;
        }

        var rawValue = input.slice(start, this.index).trim();
        if (!rawValue) {
          return "";
        }

        if (rawValue === "true") {
          return true;
        }
        if (rawValue === "false") {
          return false;
        }
        if (rawValue === "null") {
          return null;
        }
        if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
          return Number(rawValue);
        }
        return rawValue;
      },
      expect: function (char) {
        this.skipWhitespace();
        if (this.peek() !== char) {
          throw new Error("期望字符 " + char + "，实际是 " + this.peek());
        }
        this.index += 1;
      }
    };

    return state;
  }

  function normalizeParsedPayload(parsed, source) {
    if (Array.isArray(parsed)) {
      return parsed.map(function (item, idx) {
        return {
          value: item,
          source: source + "[" + (idx + 1) + "]"
        };
      });
    }

    return [{ value: parsed, source: source }];
  }

  function getUploadedInputFiles() {
    var files = []
      .concat(Array.from(refs.jsonFiles.files || []))
      .concat(Array.from(refs.jsonFolder.files || []));

    return files.filter(function (file) {
      var name = String(file.name || "").toLowerCase();
      var type = String(file.type || "").toLowerCase();

      if (name.endsWith(".json") || name.endsWith(".txt")) {
        return true;
      }

      return type.indexOf("json") >= 0 || type.indexOf("text") >= 0;
    });
  }

  function normalizeGroup(groupRaw, source) {
    if (!groupRaw || typeof groupRaw !== "object" || Array.isArray(groupRaw)) {
      throw new Error("顶层必须是对象，且包含 style / cover_title / pages。");
    }

    var styleInput = sanitizeText(groupRaw.style);
    var contentStyleInput = sanitizeText(groupRaw.content_style || groupRaw.contentStyle);

    var mappedStyle = mapStyleAlias(styleInput) || mapStyleAlias(contentStyleInput);
    if (!mappedStyle || !STYLE_PROFILES[mappedStyle]) {
      throw new Error(
        "style 无效。当前支持：xiaoxing（小星）、xiaoxing_lab（小星写作实验室）、rifu（日富）、banxia（半夏）、zhishi（芝士）、xiangxiang（香香）。"
      );
    }

    var coverTitle = sanitizeText(groupRaw.cover_title || groupRaw.coverTitle);
    if (!coverTitle) {
      throw new Error("cover_title 缺失或为空。");
    }

    if (!Array.isArray(groupRaw.pages) || groupRaw.pages.length === 0) {
      throw new Error("pages 缺失，或 pages 不是非空数组。");
    }

    var pages = groupRaw.pages.map(function (pageRaw, idx) {
      return normalizePage(pageRaw, idx + 1);
    });
    var profile = STYLE_PROFILES[mappedStyle];
    var fixedCoverSubtitle = sanitizeText(profile.coverSubtitle || "小说素材、干货分享");

    return {
      source: source,
      style: mappedStyle,
      styleInput: styleInput,
      contentStyle: contentStyleInput,
      profile: profile,
      coverTopText: sanitizeText(groupRaw.cover_top_text || groupRaw.coverTopText),
      coverTitle: coverTitle,
      coverSubtitle: fixedCoverSubtitle,
      pages: pages
    };
  }
  function normalizePage(pageRaw, pageNumber) {
    if (!pageRaw || typeof pageRaw !== "object" || Array.isArray(pageRaw)) {
      throw new Error("第 " + pageNumber + " 页必须是对象。");
    }

    var pageType = mapPageType(pageRaw.type || pageRaw.page_type || "auto");
    if (!pageType) {
      throw new Error("第 " + pageNumber + " 页 type 无效，只支持 auto/list/tag/compare。");
    }

    var items = toStringArray(pageRaw.items || pageRaw.list || pageRaw.points);
    var tags = toStringArray(pageRaw.tags);
    if (pageType === "tag" && tags.length === 0 && items.length > 0) {
      tags = items.slice();
    }

    var comparePairs = toComparePairs(
      pageRaw.compare_items ||
        pageRaw.compareItems ||
        pageRaw.pairs ||
        pageRaw.compare ||
        pageRaw.items
    );

    var left = toStringArray(pageRaw.left || pageRaw.left_items || pageRaw.pros);
    var right = toStringArray(pageRaw.right || pageRaw.right_items || pageRaw.cons);

    if (comparePairs.length === 0 && (left.length > 0 || right.length > 0)) {
      comparePairs = toComparePairsFromLeftRight(left, right);
    }

    if (comparePairs.length > 0 && (left.length === 0 || right.length === 0)) {
      left = comparePairs.map(function (pair) {
        return pair.normal;
      });
      right = comparePairs.map(function (pair) {
        return pair.better;
      });
    }

    if (pageType === "list" && items.length === 0) {
      var fallbackText = sanitizeText(pageRaw.content || pageRaw.text || pageRaw.desc);
      if (fallbackText) {
        items = [fallbackText];
      }
    }

    var page = {
      pageNumber: pageNumber,
      type: pageType,
      title: sanitizeText(pageRaw.title || pageRaw.page_title || "第 " + pageNumber + " 页"),
      subtitle: sanitizeText(pageRaw.subtitle),
      text: sanitizeText(pageRaw.content || pageRaw.text || pageRaw.desc),
      items: items,
      tags: tags,
      leftTitle: sanitizeText(pageRaw.left_title || pageRaw.pros_title || "普通"),
      rightTitle: sanitizeText(pageRaw.right_title || pageRaw.cons_title || "优化"),
      left: left,
      right: right,
      comparePairs: comparePairs
    };

    if (page.type === "list" && page.items.length === 0) {
      throw new Error("第 " + pageNumber + " 页是 list，但 items 为空。");
    }

    if (page.type === "tag" && page.tags.length === 0) {
      throw new Error("第 " + pageNumber + " 页是 tag，但 tags/items 为空。");
    }

    if (page.type === "compare" && page.comparePairs.length === 0) {
      throw new Error("第 " + pageNumber + " 页是 compare，但缺少 compare items（normal/better）。");
    }

    if (page.type === "auto") {
      var inferred = inferAutoType(page);
      if (inferred === "auto" && !page.text) {
        throw new Error("第 " + pageNumber + " 页是 auto，但无法识别内容（list/tag/compare/text）。");
      }
    }

    return page;
  }

  function toComparePairs(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var pairs = [];
    for (var i = 0; i < value.length; i += 1) {
      var item = value[i];

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      var normal = sanitizeText(item.normal || item.old || item.before || item.left);
      var better = sanitizeText(item.better || item.new || item.after || item.right);

      if (!normal && !better) {
        continue;
      }

      pairs.push({
        normal: normal,
        better: better
      });
    }

    return pairs;
  }

  function toComparePairsFromLeftRight(left, right) {
    var maxLen = Math.max(left.length, right.length);
    var pairs = [];

    for (var i = 0; i < maxLen; i += 1) {
      var normal = sanitizeText(left[i]);
      var better = sanitizeText(right[i]);
      if (!normal && !better) {
        continue;
      }
      pairs.push({ normal: normal, better: better });
    }

    return pairs;
  }

  function shouldUseGlobalSerialForGroup(group) {
    if (extractSerialLimitFromGroup(group) !== null) {
      return true;
    }

    if (!group || !Array.isArray(group.pages)) {
      return false;
    }

    for (var i = 0; i < group.pages.length; i += 1) {
      var page = group.pages[i] || {};
      if (hasAnyLeadingSerialInItems(page.items) || hasAnyLeadingSerialInItems(page.tags)) {
        return true;
      }
      if (hasAnyLeadingSerialInPairs(page.comparePairs)) {
        return true;
      }
    }

    return false;
  }

  function extractSerialLimitFromGroup(group) {
    var coverTitle = sanitizeText(group && group.coverTitle);
    var match = coverTitle.match(/(\d{1,4})\s*(个|条|组|句|名|则|款|篇|套|章)/);
    if (!match) {
      return null;
    }

    var value = parseInt(match[1], 10);
    if (Number.isNaN(value) || value <= 0) {
      return null;
    }

    return value;
  }

  function hasAnyLeadingSerialInItems(items) {
    if (!Array.isArray(items)) {
      return false;
    }

    for (var i = 0; i < items.length; i += 1) {
      if (parseLeadingSerial(items[i])) {
        return true;
      }
    }
    return false;
  }

  function hasAnyLeadingSerialInPairs(pairs) {
    if (!Array.isArray(pairs)) {
      return false;
    }

    for (var i = 0; i < pairs.length; i += 1) {
      if (parseLeadingSerial(pairs[i] && pairs[i].normal)) {
        return true;
      }
    }
    return false;
  }

  function preparePageWithGlobalSerial(page, finalType, nextSerial, serialLimit) {
    var output = page;
    var serialCursor = nextSerial;

    if (finalType === "list") {
      var normalizedList = normalizeSerialItemsForRender(
        page.items,
        serialCursor,
        serialLimit,
        hasAnyLeadingSerialInItems(page.items) || serialLimit !== null
      );
      serialCursor = normalizedList.nextSerial;
      if (normalizedList.changed) {
        output = Object.assign({}, output, {
          items: normalizedList.items
        });
      }
    } else if (finalType === "tag") {
      var useTags = page.tags.length > 0;
      var sourceItems = useTags ? page.tags : page.items;
      var normalizedTag = normalizeSerialItemsForRender(
        sourceItems,
        serialCursor,
        serialLimit,
        hasAnyLeadingSerialInItems(sourceItems) || serialLimit !== null
      );
      serialCursor = normalizedTag.nextSerial;
      if (normalizedTag.changed) {
        output = Object.assign(
          {},
          output,
          useTags
            ? {
                tags: normalizedTag.items
              }
            : {
                items: normalizedTag.items
              }
        );
      }
    } else if (finalType === "compare") {
      var normalizedCompare = normalizeComparePairsForRender(
        page.comparePairs,
        serialCursor,
        serialLimit,
        hasAnyLeadingSerialInPairs(page.comparePairs) || serialLimit !== null
      );
      serialCursor = normalizedCompare.nextSerial;
      if (normalizedCompare.changed) {
        output = Object.assign({}, output, {
          comparePairs: normalizedCompare.pairs
        });
      }
    }

    return {
      page: output,
      nextSerial: serialCursor
    };
  }

  function normalizeSerialItemsForRender(items, nextSerial, serialLimit, forceFillMissing) {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        items: Array.isArray(items) ? items : [],
        nextSerial: nextSerial,
        changed: false
      };
    }

    var normalized = [];
    var serialCursor = nextSerial;
    var changed = false;

    for (var i = 0; i < items.length; i += 1) {
      var raw = sanitizeText(items[i]);
      if (!raw) {
        normalized.push(raw);
        continue;
      }

      var parsed = parseLeadingSerial(raw);
      var shouldFillMissing =
        !!forceFillMissing && (serialLimit === null || serialCursor <= serialLimit);
      var fixed = raw;

      if (parsed) {
        fixed = forceLeadingSerial(raw, serialCursor);
      } else if (shouldFillMissing) {
        fixed = forceLeadingSerial(raw, serialCursor);
      }

      if (fixed !== raw) {
        changed = true;
      }

      normalized.push(fixed);
      if (parsed || shouldFillMissing) {
        serialCursor += 1;
      }
    }

    return {
      items: normalized,
      nextSerial: serialCursor,
      changed: changed || normalized.length !== items.length
    };
  }

  function normalizeComparePairsForRender(pairs, nextSerial, serialLimit, forceFillMissing) {
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return {
        pairs: Array.isArray(pairs) ? pairs : [],
        nextSerial: nextSerial,
        changed: false
      };
    }

    var normalized = [];
    var serialCursor = nextSerial;
    var changed = false;

    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i] || {};
      var normal = sanitizeText(pair.normal);
      var better = sanitizeText(pair.better);

      if (!normal && !better) {
        normalized.push(pair);
        continue;
      }

      var parsed = parseLeadingSerial(normal);
      var shouldFillMissing =
        !!forceFillMissing && (serialLimit === null || serialCursor <= serialLimit);
      var fixedNormal = normal;

      if (normal && parsed) {
        fixedNormal = forceLeadingSerial(normal, serialCursor);
      } else if (normal && shouldFillMissing) {
        fixedNormal = forceLeadingSerial(normal, serialCursor);
      }

      if (fixedNormal !== normal) {
        changed = true;
      }

      normalized.push(
        Object.assign({}, pair, {
          normal: fixedNormal
        })
      );

      if (normal && (parsed || shouldFillMissing)) {
        serialCursor += 1;
      }
    }

    return {
      pairs: normalized,
      nextSerial: serialCursor,
      changed: changed
    };
  }

  function forceLeadingSerial(text, serialNumber) {
    var raw = sanitizeText(text);
    if (!raw) {
      return "";
    }

    var parsed = parseLeadingSerial(raw);
    if (parsed && parsed.number === serialNumber) {
      return raw;
    }

    var body = parsed ? raw.slice(parsed.endIndex).trim() : raw;
    return String(serialNumber) + ". " + body;
  }

  function optimizeListLikePageFlow(group, warnings) {
    if (!group || !Array.isArray(group.pages)) {
      return [];
    }
    if (!group.profile) {
      return group.pages.slice();
    }
    if (
      group.profile.theme !== "xiaoxing_lab" &&
      group.profile.theme !== "rifu" &&
      group.profile.theme !== "banxia" &&
      group.profile.theme !== "zhishi" &&
      group.profile.theme !== "xiangxiang"
    ) {
      return group.pages.slice();
    }

    var pages = group.pages;
    var optimized = [];
    var index = 0;

    while (index < pages.length) {
      var page = pages[index];
      var finalType = page.type === "auto" ? inferAutoType(page) : page.type;
      if (finalType !== "list" && finalType !== "tag") {
        optimized.push(page);
        index += 1;
        continue;
      }

      var segmentPages = [];
      var segmentTypes = [];
      var segmentItems = [];

      while (index < pages.length) {
        var segmentPage = pages[index];
        var segmentType = segmentPage.type === "auto" ? inferAutoType(segmentPage) : segmentPage.type;
        if (segmentType !== "list" && segmentType !== "tag") {
          break;
        }

        segmentPages.push(segmentPage);
        segmentTypes.push(segmentType);

        var sourceItems =
          segmentType === "tag"
            ? segmentPage.tags.length > 0
              ? segmentPage.tags
              : segmentPage.items
            : segmentPage.items;

        for (var s = 0; s < sourceItems.length; s += 1) {
          var clean = sanitizeText(sourceItems[s]);
          if (clean) {
            segmentItems.push(clean);
          }
        }

        index += 1;
      }

      if (segmentItems.length === 0) {
        for (var e = 0; e < segmentPages.length; e += 1) {
          optimized.push(segmentPages[e]);
        }
        continue;
      }

      var repacked = repackListLikeItemsForTheme(segmentItems, group, segmentTypes);
      var changed = !isSameListLikePagination(segmentPages, segmentTypes, repacked);

      if (!changed) {
        for (var keep = 0; keep < segmentPages.length; keep += 1) {
          optimized.push(segmentPages[keep]);
        }
        continue;
      }

      if (warnings && typeof warnings.add === "function") {
        warnings.add(
          group.source +
            " 已自动优化分页：内页从 " +
            segmentPages.length +
            " 页调整为 " +
            repacked.length +
            " 页，减少空白并保持不溢出。"
        );
      }

      for (var r = 0; r < repacked.length; r += 1) {
        var tplIdx = Math.min(r, segmentPages.length - 1);
        var templatePage = segmentPages[tplIdx];
        var templateType = segmentTypes[tplIdx];
        var rebuilt = Object.assign({}, templatePage);

        if (templateType === "tag") {
          if (templatePage.tags.length > 0) {
            rebuilt.tags = repacked[r];
            rebuilt.items = Array.isArray(templatePage.items) ? templatePage.items.slice() : [];
          } else {
            rebuilt.items = repacked[r];
            rebuilt.tags = [];
          }
        } else {
          rebuilt.items = repacked[r];
          rebuilt.tags = Array.isArray(templatePage.tags) ? templatePage.tags.slice() : [];
        }

        optimized.push(rebuilt);
      }
    }

    return optimized.map(function (pageItem, idx) {
      return Object.assign({}, pageItem, {
        pageNumber: idx + 1,
        title: sanitizeText(pageItem.title || "第 " + (idx + 1) + " 页")
      });
    });
  }

  function repackListLikeItemsForTheme(items, group, segmentTypes) {
    var content = items.filter(Boolean);
    if (content.length === 0) {
      return [];
    }

    var testCtx = createCanvas().getContext("2d");
    var canFitCandidate;

    if (
      group.profile.theme === "xiaoxing_lab" ||
      group.profile.theme === "banxia" ||
      group.profile.theme === "zhishi"
    ) {
      testCtx.fillStyle = "#111";
      testCtx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
      canFitCandidate = function (candidate) {
        return canFitXiaoxingListItems(testCtx, candidate, group.profile.layout.page);
      };
    } else if (group.profile.theme === "rifu") {
      canFitCandidate = function (candidate) {
        return canFitRifuListItems(testCtx, candidate, group.profile, segmentTypes);
      };
    } else if (group.profile.theme === "xiangxiang") {
      canFitCandidate = function (candidate) {
        return canFitXiangxiangListItems(testCtx, candidate, group.profile, segmentTypes);
      };
    } else {
      return [content];
    }

    var pages = [];
    var current = [];

    for (var i = 0; i < content.length; i += 1) {
      var item = content[i];

      if (current.length === 0) {
        current.push(item);
        continue;
      }

      var candidate = current.concat(item);
      if (canFitCandidate(candidate)) {
        current.push(item);
      } else {
        pages.push(current);
        current = [item];
      }
    }

    if (current.length > 0) {
      pages.push(current);
    }

    return collapseSparseTailPagesWithFit(pages, canFitCandidate);
  }

  function collapseSparseTailPagesWithFit(pages, canFitCandidate) {
    var result = pages.slice();
    while (result.length > 1) {
      var last = result[result.length - 1];
      var prev = result[result.length - 2];
      var merged = prev.concat(last);
      if (!canFitCandidate(merged)) {
        break;
      }
      result[result.length - 2] = merged;
      result.pop();
    }
    return result;
  }

  function canFitRifuListItems(ctx, items, profile, segmentTypes) {
    var typography = profile.typography || {};
    var layout = (profile.layout && profile.layout.page) || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var bodySize = typography.bodySize || 40;
    var bodyWeight = typography.bodyWeight || 500;
    var leadWeight = typography.leadWeight || 700;
    var fonts = {
      regular: String(bodyWeight) + " " + String(bodySize) + "px " + family,
      lead: String(leadWeight) + " " + String(bodySize) + "px " + family
    };
    var colors = {
      textPrimary: "#111111",
      textSecondary: "#111111"
    };
    var types = Array.isArray(segmentTypes) ? segmentTypes : [];
    var shouldCheckList = types.length === 0 || types.indexOf("list") >= 0;
    var shouldCheckTag = types.indexOf("tag") >= 0;
    var bodyX = typeof layout.bodyX === "number" ? layout.bodyX : 68;
    var bodyY = typeof layout.bodyY === "number" ? layout.bodyY : 176;
    var bodyWidth = typeof layout.bodyWidth === "number" ? layout.bodyWidth : 934;
    var bodyMaxY = typeof layout.bodyMaxY === "number" ? layout.bodyMaxY : 1248;
    var lineHeight = typeof layout.itemLineHeight === "number" ? layout.itemLineHeight : 48;
    var itemGap = typeof layout.itemGap === "number" ? layout.itemGap : 52;

    if (shouldCheckList) {
      var listResult = drawRifuList(
        ctx,
        items,
        bodyX,
        bodyY,
        bodyWidth,
        bodyMaxY,
        lineHeight,
        itemGap,
        fonts,
        colors
      );
      if (listResult && listResult.truncated) {
        return false;
      }
    }

    if (shouldCheckTag) {
      var tagResult = drawRifuTag(
        ctx,
        items,
        bodyX,
        bodyY,
        bodyWidth,
        bodyMaxY,
        lineHeight,
        itemGap,
        fonts,
        colors
      );
      if (tagResult && tagResult.truncated) {
        return false;
      }
    }

    return true;
  }

  function canFitXiangxiangListItems(ctx, items, profile, segmentTypes) {
    var typography = profile.typography || {};
    var layout = (profile.layout && profile.layout.page) || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var bodySize = typography.bodySize || 45;
    var bodyWeight = typography.bodyWeight || 500;
    var leadWeight = typography.leadWeight || 700;
    var fonts = {
      regular: String(bodyWeight) + " " + String(bodySize) + "px " + family,
      lead: String(leadWeight) + " " + String(bodySize) + "px " + family
    };
    var colors = {
      textPrimary: "#111111",
      textSecondary: "#111111"
    };
    var types = Array.isArray(segmentTypes) ? segmentTypes : [];
    var shouldCheckList = types.length === 0 || types.indexOf("list") >= 0;
    var shouldCheckTag = types.indexOf("tag") >= 0;
    var bodyX = typeof layout.bodyX === "number" ? layout.bodyX : 83;
    var bodyY = typeof layout.bodyY === "number" ? layout.bodyY : 182;
    var bodyWidth = typeof layout.bodyWidth === "number" ? layout.bodyWidth : 909;
    var bodyMaxY = typeof layout.bodyMaxY === "number" ? layout.bodyMaxY : 1000;
    var lineHeight = typeof layout.itemLineHeight === "number" ? layout.itemLineHeight : 56;
    var itemGap = typeof layout.itemGap === "number" ? layout.itemGap : 20;

    if (shouldCheckList) {
      var listResult = drawXiangxiangList(
        ctx,
        items,
        bodyX,
        bodyY,
        bodyWidth,
        bodyMaxY,
        lineHeight,
        itemGap,
        fonts,
        colors
      );
      if (listResult && listResult.truncated) {
        return false;
      }
    }

    if (shouldCheckTag) {
      var tagResult = drawXiangxiangTag(
        ctx,
        items,
        bodyX,
        bodyY,
        bodyWidth,
        bodyMaxY,
        lineHeight,
        itemGap,
        fonts,
        colors
      );
      if (tagResult && tagResult.truncated) {
        return false;
      }
    }

    return true;
  }

  function canFitXiaoxingListItems(ctx, items, layout) {
    var y = layout.bodyY;
    var width = layout.bodyWidth;
    var lineHeight = layout.itemLineHeight;
    var maxY = layout.bodyMaxY;
    var itemGap = layout.itemGap;

    for (var i = 0; i < items.length; i += 1) {
      var text = sanitizeText(items[i]);
      var lines = splitTextByWidth(ctx, text, width);
      for (var l = 0; l < lines.length; l += 1) {
        if (y > maxY) {
          return false;
        }
        y += lineHeight;
      }

      y += itemGap;
      if (y > maxY && i < items.length - 1) {
        return false;
      }
    }

    return true;
  }

  function isSameListLikePagination(segmentPages, segmentTypes, repacked) {
    if (segmentPages.length !== repacked.length) {
      return false;
    }

    for (var i = 0; i < segmentPages.length; i += 1) {
      var page = segmentPages[i];
      var pageType = segmentTypes[i];
      var origin = pageType === "tag" ? (page.tags.length > 0 ? page.tags : page.items) : page.items;
      var originalItems = origin.map(sanitizeText).filter(Boolean);
      var newItems = repacked[i].map(sanitizeText).filter(Boolean);

      if (originalItems.length !== newItems.length) {
        return false;
      }

      for (var j = 0; j < originalItems.length; j += 1) {
        if (originalItems[j] !== newItems[j]) {
          return false;
        }
      }
    }

    return true;
  }

  async function renderOneGroup(group, groupIndex, warnings) {
    var images = [];
    var pagesForRender = optimizeListLikePageFlow(group, warnings);
    var renderGroup = Object.assign({}, group, {
      pages: pagesForRender
    });
    var useGlobalSerial = shouldUseGlobalSerialForGroup(renderGroup);
    var serialLimit = extractSerialLimitFromGroup(group);
    var nextSerial = 1;

    var coverCanvas = createCanvas();
    var coverCtx = coverCanvas.getContext("2d");

    await drawBackground(coverCtx, group, "cover", true, warnings);
    if (group.profile.theme === "xiaoxing_lab") {
      drawXiaoxingLabCover(coverCtx, group);
    } else if (group.profile.theme === "banxia") {
      drawBanxiaCover(coverCtx, group);
    } else if (group.profile.theme === "zhishi") {
      drawZhishiCover(coverCtx, group);
    } else if (group.profile.theme === "xiangxiang") {
      drawXiangxiangCover(coverCtx, group);
    } else if (group.profile.theme === "rifu") {
      drawRifuCover(coverCtx, group);
    } else {
      drawDefaultCover(coverCtx, group, groupIndex);
    }

    images.push({
      label: "封面",
      kind: "cover",
      url: canvasToJpeg(coverCanvas)
    });

    for (var i = 0; i < pagesForRender.length; i += 1) {
      var page = pagesForRender[i];
      var finalType = page.type === "auto" ? inferAutoType(page) : page.type;
      var preparedPage = page;

      if (useGlobalSerial) {
        var prepared = preparePageWithGlobalSerial(page, finalType, nextSerial, serialLimit);
        preparedPage = prepared.page;
        nextSerial = prepared.nextSerial;
      }

      var pageCanvas = createCanvas();
      var pageCtx = pageCanvas.getContext("2d");

      await drawBackground(pageCtx, group, finalType, false, warnings);

      if (
        group.profile.theme === "xiaoxing_lab" ||
        group.profile.theme === "banxia" ||
        group.profile.theme === "zhishi"
      ) {
        drawXiaoxingLabPage(pageCtx, renderGroup, preparedPage, finalType, warnings);
      } else if (group.profile.theme === "xiangxiang") {
        drawXiangxiangPage(pageCtx, renderGroup, preparedPage, finalType, warnings);
      } else if (group.profile.theme === "rifu") {
        drawRifuPage(pageCtx, renderGroup, preparedPage, finalType, warnings);
      } else {
        drawDefaultPage(pageCtx, preparedPage, finalType, i + 1, pagesForRender.length);
      }

      images.push({
        label: "内页 " + (i + 1) + " · " + finalType,
        kind: "page-" + (i + 1),
        url: canvasToJpeg(pageCanvas)
      });
    }

    return {
      group: group,
      images: images
    };
  }

  function createCanvas() {
    var canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    return canvas;
  }

  async function drawBackground(ctx, group, pageType, isCover, warnings) {
    var profile = group.profile;
    var styleKey = profile.background.styleKey;
    var dataUri = resolveEmbeddedBackground(styleKey, pageType, isCover);

    if (dataUri) {
      try {
        var image = await loadImage(dataUri);
        ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        return;
      } catch (error) {
        if (!profile.background.allowFallback) {
          throw new Error(
            "样式 " +
              profile.id +
              " 必须使用内嵌底图，但底图加载失败。请检查 embedded-backgrounds.js 是否包含该样式底图。"
          );
        }
        warnings.add("底图加载失败，已自动回退到内置渐变背景。");
        drawFallbackGradient(ctx, pageType, isCover);
        return;
      }
    }
    if (!profile.background.allowFallback) {
      throw new Error(
        "样式 " + profile.id + " 要求严格底图，不允许兜底背景。请先在 embedded-backgrounds.js 中配置对应底图。"
      );
    }

    warnings.add(
      "样式 " +
        styleKey +
        " 的 " +
        (isCover ? "封面" : pageType) +
        " 背景缺失，已自动回退到内置渐变背景。"
    );
    drawFallbackGradient(ctx, pageType, isCover);
  }

  function resolveEmbeddedBackground(styleKey, pageType, isCover) {
    var root = window.XHS_EMBEDDED_BACKGROUNDS || {};
    var styleConfig = root[styleKey];

    if (!styleConfig) {
      return null;
    }

    if (isCover) {
      return styleConfig.cover || styleConfig.title || null;
    }

    var pages = styleConfig.pages || {};
    return pages[pageType] || pages.auto || styleConfig.page || null;
  }

  function drawFallbackGradient(ctx, pageType, isCover) {
    var palette = {
      cover: ["#2c7a94", "#f59d3d"],
      auto: ["#3b678d", "#ef9360"],
      list: ["#367b7a", "#dfab56"],
      tag: ["#28658a", "#e87843"],
      compare: ["#42659a", "#de7666"]
    };

    var key = isCover ? "cover" : pageType;
    var colors = palette[key] || palette.auto;

    var g = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(140, 180, 190, 0, Math.PI * 2);
    ctx.arc(930, 1240, 240, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAccountACover(ctx, group) {
    var profile = group.profile;
    var colors = profile.colors;
    var box = profile.layout.cover;

    var topText = group.coverTopText || "";
    var title = ensureQuotedTitle(group.coverTitle);
    var subtitle = group.coverSubtitle || "小说素材、干货分享";

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "700 107px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
    drawWrappedLimited(
      ctx,
      topText,
      box.topTextX,
      box.topTextY,
      box.topTextWidth,
      box.topTextLineHeight,
      box.topTextMaxLines,
      null
    );

    ctx.fillStyle = colors.textPrimary;
    drawCoverMainTitleSingleLine(ctx, title, box.titleX, box.titleY, box.titleWidth);

    drawCoverTagsPlain(ctx, subtitle, box.subtitleX, box.subtitleY, colors);
  }

  function drawCoverMainTitleSingleLine(ctx, title, x, y, maxWidth) {
    var fontSize = 156;
    var minSize = 120;
    var text = title || "";

    while (fontSize > minSize) {
      ctx.font =
        "700 " + fontSize + "px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
      if (ctx.measureText(text).width <= maxWidth) {
        break;
      }
      fontSize -= 2;
    }

    ctx.fillText(text, x, y);
  }

  function drawCoverTagsPlain(ctx, subtitle, x, y, colors) {
    var tags = String(subtitle || "")
      .split(/[，,、\/\s]+/g)
      .map(function (item) {
        return sanitizeText(item);
      })
      .filter(Boolean);

    if (tags.length === 0) {
      tags = ["小说素材", "干货分享"];
    }

    ctx.fillStyle = colors.textAccent;
    ctx.font = "700 56px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
    ctx.fillText(tags.join("、"), x, y);
  }

  function drawAccountAPage(ctx, group, page, finalType, warnings) {
    var profile = group.profile;
    var colors = profile.colors;
    var pageLayout = profile.layout.page;

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "700 60px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
    drawWrappedLimited(
      ctx,
      page.title,
      pageLayout.titleX,
      pageLayout.titleY,
      pageLayout.titleWidth,
      pageLayout.titleLineHeight,
      pageLayout.titleMaxLines,
      null
    );

    var contentStartY = pageLayout.bodyY;
    var bodyX = pageLayout.bodyX;
    var bodyWidth = pageLayout.bodyWidth;
    var bodyMaxY = pageLayout.bodyMaxY;

    var result;
    if (finalType === "list") {
      result = drawAccountAList(ctx, page.items, bodyX, contentStartY, bodyWidth, bodyMaxY, colors);
    } else if (finalType === "tag") {
      var tags = page.tags.length > 0 ? page.tags : page.items;
      result = drawAccountATag(ctx, tags, bodyX, contentStartY, bodyWidth, bodyMaxY, colors);
    } else if (finalType === "compare") {
      result = drawAccountACompare(ctx, page.comparePairs, bodyX, contentStartY, bodyWidth, bodyMaxY, colors);
    } else {
      result = drawAccountAAutoText(ctx, page.text, bodyX, contentStartY, bodyWidth, bodyMaxY, colors);
    }

    if (result && result.truncated) {
      warnings.add(
        group.source +
          " 第 " +
          page.pageNumber +
          " 页内容超出高度，已截断。可减少条目或拆分更多页面。"
      );
    }
  }

  function drawAccountAList(ctx, items, x, startY, width, maxY, colors) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < items.length; i += 1) {
      var parsed = splitHeadingAndBody(items[i]);
      var titleText = withAutoSerialIfNeeded(i, parsed.heading);

      ctx.fillStyle = colors.textPrimary;
      ctx.font = "700 56px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
      var headingLines = splitTextByWidth(ctx, titleText, width);
      var headingRows = drawLinesWithMaxY(ctx, headingLines, x, y, 66, maxY);
      y = headingRows.nextY;

      if (headingRows.truncated) {
        truncated = true;
        break;
      }

      if (parsed.body) {
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "500 48px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
        var bodyLines = splitTextByWidth(ctx, parsed.body, width);
        var bodyRows = drawLinesWithMaxY(ctx, bodyLines, x + 4, y, 60, maxY);
        y = bodyRows.nextY;

        if (bodyRows.truncated) {
          truncated = true;
          break;
        }
      }

      y += 20;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawAccountATag(ctx, tags, x, startY, width, maxY, colors) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < tags.length; i += 1) {
      var parsed = splitTagLabel(tags[i]);
      var blockText = parsed.label ? parsed.label + " " + parsed.body : tags[i];

      ctx.fillStyle = colors.textSecondary;
      ctx.font = "500 46px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
      var lines = splitTextByWidth(ctx, "• " + blockText, width);
      var rows = drawLinesWithMaxY(ctx, lines, x, y, 58, maxY);
      y = rows.nextY;

      if (rows.truncated) {
        truncated = true;
        break;
      }

      y += 18;
      if (y > maxY) {
        truncated = i < tags.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawAccountACompare(ctx, pairs, x, startY, width, maxY, colors) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i];
      var normal = sanitizeText(pair.normal);

      if (normal) {
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "700 50px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
        var normalLines = splitTextByWidth(ctx, withAutoSerialIfNeeded(i, normal), width);
        var normalRows = drawLinesWithMaxY(ctx, normalLines, x, y, 62, maxY);
        y = normalRows.nextY;
        if (normalRows.truncated) {
          truncated = true;
          break;
        }
      }

      if (pair.better) {
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "500 46px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";
        var betterLines = splitTextByWidth(ctx, "优化：" + pair.better, width);
        var betterRows = drawLinesWithMaxY(ctx, betterLines, x + 4, y, 58, maxY);
        y = betterRows.nextY;
        if (betterRows.truncated) {
          truncated = true;
          break;
        }
      }

      y += 20;
      if (y > maxY) {
        truncated = i < pairs.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawAccountAAutoText(ctx, text, x, startY, width, maxY, colors) {
    ctx.fillStyle = colors.textSecondary;
    ctx.font = "500 50px 'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif";

    var lines = splitTextByWidth(ctx, text || "", width);
    var rows = drawLinesWithMaxY(ctx, lines, x, startY, 62, maxY);
    return { truncated: rows.truncated };
  }

  function drawXiaoxingLabDecor(ctx, profile) {
    var decor = profile.ornaments;
    var colors = profile.colors;

    ctx.strokeStyle = colors.ornamentLight;
    ctx.lineWidth = decor.topLeftDotLineWidth;
    for (var i = 0; i < 3; i += 1) {
      var dotX = decor.topLeftDotsX + i * decor.topLeftDotGap;
      ctx.beginPath();
      ctx.arc(dotX, decor.topLeftDotsY, decor.topLeftDotRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "700 " + decor.topRightQuoteFontSize + "px 'STSong', 'Noto Serif SC', serif";
    ctx.fillText("”", decor.topRightQuoteX, decor.topRightQuoteY);

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "700 " + decor.bottomLeftQuoteFontSize + "px 'STSong', 'Noto Serif SC', serif";
    ctx.fillText("“", decor.bottomLeftQuoteX, decor.bottomLeftQuoteY);

    ctx.strokeStyle = colors.ornamentDark;
    ctx.lineWidth = decor.bottomLineWidth;
    ctx.beginPath();
    ctx.moveTo(decor.bottomLineX1, decor.bottomLineY);
    ctx.lineTo(decor.bottomLineX2, decor.bottomLineY);
    ctx.stroke();
  }

  function drawXiaoxingLabCover(ctx, group) {
    var profile = group.profile;
    var colors = profile.colors;
    var box = profile.layout.cover;
    var topText = sanitizeText(group.coverTopText);
    var title = sanitizeText(group.coverTitle);
    var subtitle = sanitizeText(group.coverSubtitle || "小说素材、干货分享");

    if (topText) {
      ctx.fillStyle = colors.textPrimary;
      ctx.font = "700 80px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
      drawWrappedLimited(
        ctx,
        topText,
        box.topTextX,
        box.topTextY,
        box.topTextWidth,
        box.topTextLineHeight,
        box.topTextMaxLines,
        null
      );
    }

    drawXiaoxingLabCoverTitle(ctx, title, box, colors);

    var subtitleSize = fitTextFontSize(
      ctx,
      subtitle,
      box.subtitleWidth,
      box.subtitleMaxLines,
      60,
      46,
      "600",
      "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif"
    );
    ctx.fillStyle = colors.textSecondary;
    ctx.font =
      "600 " + subtitleSize + "px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    drawWrappedLimited(
      ctx,
      subtitle,
      box.subtitleX,
      box.subtitleY,
      box.subtitleWidth,
      box.subtitleLineHeight,
      box.subtitleMaxLines,
      null
    );
  }

  function drawXiaoxingLabCoverTitle(ctx, rawTitle, box, colors) {
    var title = stripOuterQuotes(rawTitle).replace(/[\r\n]+/g, "");
    if (!title) {
      return;
    }

    var fontFamily = "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var maxWidth = box.titleWidth;
    var openQuote = "“";
    var closeQuote = "”";
    var singleLineSize = findSingleLineCoverTitleSize(ctx, title, maxWidth, 132, 100, fontFamily);

    ctx.fillStyle = colors.textPrimary;

    if (singleLineSize) {
      ctx.font = "700 " + singleLineSize + "px " + fontFamily;
      ctx.fillText(openQuote + title + closeQuote, box.titleX, box.titleY);
      return;
    }

    var twoLineLayout = fitTwoLineQuotedCoverTitle(ctx, title, maxWidth, 132, 94, fontFamily);
    ctx.font = "700 " + twoLineLayout.fontSize + "px " + fontFamily;
    if (!twoLineLayout.lines[1]) {
      ctx.fillText(openQuote + twoLineLayout.lines[0] + closeQuote, box.titleX, box.titleY);
      return;
    }
    ctx.fillText(openQuote + twoLineLayout.lines[0], box.titleX, box.titleY);
    ctx.fillText(
      twoLineLayout.lines[1] + closeQuote,
      box.titleX,
      box.titleY + box.titleLineHeight
    );
  }

  function findSingleLineCoverTitleSize(ctx, title, maxWidth, startSize, minSize, fontFamily) {
    for (var size = startSize; size >= minSize; size -= 2) {
      ctx.font = "700 " + size + "px " + fontFamily;
      if (ctx.measureText("“" + title + "”").width <= maxWidth) {
        return size;
      }
    }
    return null;
  }

  function fitTwoLineQuotedCoverTitle(ctx, title, maxWidth, startSize, minSize, fontFamily) {
    for (var size = startSize; size >= minSize; size -= 2) {
      ctx.font = "700 " + size + "px " + fontFamily;
      var split = splitTitleToTwoLinesWithQuotes(ctx, title, maxWidth);
      if (split) {
        return {
          fontSize: size,
          lines: split
        };
      }
    }

    var fallback = forceTitleIntoTwoLines(title);
    return {
      fontSize: minSize,
      lines: fallback
    };
  }

  function splitTitleToTwoLinesWithQuotes(ctx, title, maxWidth) {
    if (!title || title.length < 2) {
      return null;
    }

    var best = null;
    var bestScore = Infinity;

    for (var i = 1; i < title.length; i += 1) {
      var first = title.slice(0, i);
      var second = title.slice(i);

      if (second.length < 2) {
        continue;
      }

      var firstWidth = ctx.measureText("“" + first).width;
      var secondWidth = ctx.measureText(second + "”").width;

      if (firstWidth > maxWidth || secondWidth > maxWidth) {
        continue;
      }

      var score = Math.abs(firstWidth - secondWidth);
      if (score < bestScore) {
        bestScore = score;
        best = [first, second];
      }
    }

    return best;
  }

  function forceTitleIntoTwoLines(title) {
    var text = String(title || "");
    if (text.length <= 1) {
      return [text, ""];
    }
    if (text.length === 2) {
      return [text.charAt(0), text.charAt(1)];
    }

    var splitAt = Math.ceil(text.length / 2);
    var first = text.slice(0, splitAt);
    var second = text.slice(splitAt);
    if (!second) {
      second = first;
    }

    return [first, second];
  }

  function drawXiaoxingLabPage(ctx, group, page, finalType, warnings) {
    var profile = group.profile;
    var colors = profile.colors;
    var layout = profile.layout.page;
    var result;

    if (finalType === "list") {
      result = drawXiaoxingLabList(
        ctx,
        page.items,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        colors
      );
    } else if (finalType === "tag") {
      var tagItems = page.tags.length > 0 ? page.tags : page.items;
      result = drawXiaoxingLabTag(
        ctx,
        tagItems,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        colors
      );
    } else if (finalType === "compare") {
      result = drawXiaoxingLabCompare(
        ctx,
        page.comparePairs,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        colors
      );
    } else {
      result = drawXiaoxingLabAutoText(
        ctx,
        page.text,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        colors
      );
    }

    if (result && result.truncated) {
      warnings.add(
        group.source +
          " 第 " +
          page.pageNumber +
          " 页内容超出高度，已截断。可减少条目或拆分更多页面。"
      );
    }
  }

  function drawXiaoxingLabList(ctx, items, x, startY, width, maxY, lineHeight, itemGap, colors) {
    var y = startY;
    var truncated = false;

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";

    for (var i = 0; i < items.length; i += 1) {
      var block = withAutoSerialIfNeeded(i, items[i]);
      var lines = splitTextByWidth(ctx, block, width);
      var rows = drawLinesWithMaxY(ctx, lines, x, y, lineHeight, maxY);
      y = rows.nextY;

      if (rows.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiaoxingLabTag(ctx, items, x, startY, width, maxY, lineHeight, itemGap, colors) {
    var y = startY;
    var truncated = false;

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";

    for (var i = 0; i < items.length; i += 1) {
      var text = withAutoSerialIfNeeded(i, items[i]);
      var lines = splitTextByWidth(ctx, text, width);
      var rows = drawLinesWithMaxY(ctx, lines, x, y, lineHeight, maxY);
      y = rows.nextY;

      if (rows.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiaoxingLabCompare(
    ctx,
    pairs,
    x,
    startY,
    width,
    maxY,
    lineHeight,
    itemGap,
    colors
  ) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i];
      var normal = sanitizeText(pair.normal);
      var better = sanitizeText(pair.better);

      if (normal) {
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
        var normalLines = splitTextByWidth(ctx, withAutoSerialIfNeeded(i, normal), width);
        var normalRows = drawLinesWithMaxY(ctx, normalLines, x, y, lineHeight, maxY);
        y = normalRows.nextY;
        if (normalRows.truncated) {
          truncated = true;
          break;
        }
      }

      if (better) {
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
        var betterLines = splitTextByWidth(ctx, "优化：" + better, width);
        var betterRows = drawLinesWithMaxY(ctx, betterLines, x + 2, y, lineHeight - 2, maxY);
        y = betterRows.nextY;
        if (betterRows.truncated) {
          truncated = true;
          break;
        }
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < pairs.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiaoxingLabAutoText(ctx, text, x, startY, width, maxY, lineHeight, colors) {
    ctx.fillStyle = colors.textPrimary;
    ctx.font = "500 45px 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var lines = splitTextByWidth(ctx, sanitizeText(text), width);
    var rows = drawLinesWithMaxY(ctx, lines, x, startY, lineHeight, maxY);
    return { truncated: rows.truncated };
  }

  function drawBanxiaCover(ctx, group) {
    var profile = group.profile;
    var colors = profile.colors || {};
    var typography = profile.typography || {};
    var box = profile.layout.cover || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var topText = sanitizeText(group.coverTopText);
    var title = sanitizeText(group.coverTitle);
    var subtitle = sanitizeText(
      group.coverSubtitle || profile.coverSubtitle || "小说素材｜写作技巧｜干货分享"
    );
    var topWeight = typography.coverTopWeight || 500;
    var subtitleWeight = typography.coverSubtitleWeight || 500;
    var topTextX = Math.round((box.topTextCenterX || CANVAS_WIDTH / 2) - box.topTextWidth / 2);
    var subtitleX = Math.round((box.subtitleCenterX || CANVAS_WIDTH / 2) - box.subtitleWidth / 2);

    if (topText) {
      var topSize = fitTextFontSize(
        ctx,
        topText,
        box.topTextWidth,
        box.topTextMaxLines,
        typography.coverTopSize || 58,
        42,
        String(topWeight),
        family
      );
      ctx.fillStyle = colors.textSecondary || colors.textPrimary || "#111111";
      ctx.font = String(topWeight) + " " + topSize + "px " + family;
      drawWrappedLimited(
        ctx,
        topText,
        topTextX,
        box.topTextY,
        box.topTextWidth,
        box.topTextLineHeight,
        box.topTextMaxLines,
        null
      );
    }

    drawRifuCoverTitle(ctx, title, box, typography, {
      textPrimary: colors.textPrimary || "#111111"
    });

    var subtitleSize = fitTextFontSize(
      ctx,
      subtitle,
      box.subtitleWidth,
      box.subtitleMaxLines,
      typography.coverSubtitleStartSize || 60,
      typography.coverSubtitleMinSize || 46,
      String(subtitleWeight),
      family
    );
    ctx.fillStyle = colors.textPrimary || "#111111";
    ctx.font = String(subtitleWeight) + " " + subtitleSize + "px " + family;
    drawWrappedLimited(
      ctx,
      subtitle,
      subtitleX,
      box.subtitleY,
      box.subtitleWidth,
      box.subtitleLineHeight,
      box.subtitleMaxLines,
      null
    );
  }

  function drawZhishiCover(ctx, group) {
    drawRifuCover(ctx, group);
  }

  function drawXiangxiangCover(ctx, group) {
    drawRifuCover(ctx, group);
  }

  function drawRifuCover(ctx, group) {
    var profile = group.profile;
    var colors = profile.colors || {};
    var typography = profile.typography || {};
    var box = profile.layout.cover || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var topText = sanitizeText(group.coverTopText);
    var title = sanitizeText(group.coverTitle);
    var subtitle = sanitizeText(group.coverSubtitle || "小说素材、干货分享");
    var topWeight = typography.coverTopWeight || 500;
    var subtitleWeight = typography.coverSubtitleWeight || 600;

    if (topText) {
      var topSize = fitTextFontSize(
        ctx,
        topText,
        box.topTextWidth,
        box.topTextMaxLines,
        typography.coverTopSize || 58,
        42,
        String(topWeight),
        family
      );
      ctx.fillStyle = colors.textSecondary || colors.textPrimary || "#111111";
      ctx.font = String(topWeight) + " " + topSize + "px " + family;
      drawWrappedLimited(
        ctx,
        topText,
        box.topTextX,
        box.topTextY,
        box.topTextWidth,
        box.topTextLineHeight,
        box.topTextMaxLines,
        null
      );
    }

    drawRifuCoverTitle(ctx, title, box, typography, colors);

    var subtitleSize = fitTextFontSize(
      ctx,
      subtitle,
      box.subtitleWidth,
      box.subtitleMaxLines,
      typography.coverSubtitleStartSize || 60,
      typography.coverSubtitleMinSize || 46,
      String(subtitleWeight),
      family
    );
    ctx.fillStyle = colors.textPrimary || "#111111";
    ctx.font = String(subtitleWeight) + " " + subtitleSize + "px " + family;
    drawWrappedLimited(
      ctx,
      subtitle,
      Math.round((box.subtitleCenterX || CANVAS_WIDTH / 2) - box.subtitleWidth / 2),
      box.subtitleY,
      box.subtitleWidth,
      box.subtitleLineHeight,
      box.subtitleMaxLines,
      null
    );
  }

  function drawRifuCoverTitle(ctx, rawTitle, box, typography, colors) {
    var title = stripOuterQuotes(rawTitle).replace(/[\r\n]+/g, "");
    if (!title) {
      return;
    }

    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var centerX = box.titleCenterX || Math.round(CANVAS_WIDTH / 2);
    var maxWidth = box.titleWidth || 644;
    var startSize = typography.coverTitleStartSize || 132;
    var minSize = typography.coverTitleMinSize || 98;
    var weight = typography.coverTitleWeight || 700;
    var openQuote = "“";
    var closeQuote = "”";
    var singleLineSize = findSingleLineCoverTitleSize(ctx, title, maxWidth, startSize, minSize, family);

    ctx.fillStyle = colors.textPrimary || "#111111";

    if (singleLineSize) {
      var singleText = openQuote + title + closeQuote;
      ctx.font = String(weight) + " " + singleLineSize + "px " + family;
      ctx.fillText(singleText, centerX - ctx.measureText(singleText).width / 2, box.titleY);
      return;
    }

    var twoLineLayout = fitTwoLineQuotedCoverTitle(ctx, title, maxWidth, startSize, minSize, family);
    ctx.font = String(weight) + " " + twoLineLayout.fontSize + "px " + family;

    if (!twoLineLayout.lines[1]) {
      var fallbackSingle = openQuote + twoLineLayout.lines[0] + closeQuote;
      ctx.fillText(fallbackSingle, centerX - ctx.measureText(fallbackSingle).width / 2, box.titleY);
      return;
    }

    var firstLine = openQuote + twoLineLayout.lines[0];
    var secondLine = twoLineLayout.lines[1] + closeQuote;
    ctx.fillText(firstLine, centerX - ctx.measureText(firstLine).width / 2, box.titleY);
    ctx.fillText(
      secondLine,
      centerX - ctx.measureText(secondLine).width / 2,
      box.titleY + box.titleLineHeight
    );
  }

  function drawXiangxiangPage(ctx, group, page, finalType, warnings) {
    var profile = group.profile;
    var colors = profile.colors || {};
    var typography = profile.typography || {};
    var layout = profile.layout.page || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var fonts = {
      regular:
        String(typography.bodyWeight || 500) + " " + String(typography.bodySize || 45) + "px " + family,
      lead:
        String(typography.leadWeight || 700) + " " + String(typography.bodySize || 45) + "px " + family
    };
    var titleText = sanitizeText(page.title);
    var titleSize = fitTextFontSize(
      ctx,
      titleText,
      layout.titleWidth,
      layout.titleMaxLines,
      typography.pageTitleSize || 60,
      40,
      String(typography.pageTitleWeight || 700),
      family
    );
    var result;

    ctx.fillStyle = colors.textPrimary || "#1C1C1C";
    ctx.font = String(typography.pageTitleWeight || 700) + " " + titleSize + "px " + family;
    drawWrappedLimited(
      ctx,
      titleText,
      layout.titleX,
      layout.titleY,
      layout.titleWidth,
      layout.titleLineHeight,
      layout.titleMaxLines,
      null
    );

    if (finalType === "list") {
      result = drawXiangxiangList(
        ctx,
        page.items,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else if (finalType === "tag") {
      var tagItems = page.tags.length > 0 ? page.tags : page.items;
      result = drawXiangxiangTag(
        ctx,
        tagItems,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else if (finalType === "compare") {
      result = drawXiangxiangCompare(
        ctx,
        page.comparePairs,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else {
      result = drawXiangxiangAutoText(
        ctx,
        page.text,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        fonts,
        colors
      );
    }

    if (result && result.truncated) {
      warnings.add(
        group.source +
          " 第 " +
          page.pageNumber +
          " 页内容超出高度，已截断。可减少条目或拆分更多页面。"
      );
    }
  }

  function drawXiangxiangList(ctx, items, x, startY, width, maxY, lineHeight, itemGap, fonts, colors) {
    var y = startY;
    var truncated = false;

    ctx.fillStyle = colors.textPrimary || "#1C1C1C";
    ctx.font = fonts.regular;

    for (var i = 0; i < items.length; i += 1) {
      var raw = withAutoSerialIfNeeded(i, items[i]);
      var lines = splitTextByWidth(ctx, raw, width);
      var rows = drawLinesWithMaxY(ctx, lines, x, y, lineHeight, maxY);
      y = rows.nextY;

      if (rows.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiangxiangTag(ctx, items, x, startY, width, maxY, lineHeight, itemGap, fonts, colors) {
    var y = startY;
    var truncated = false;

    ctx.fillStyle = colors.textPrimary || "#1C1C1C";
    ctx.font = fonts.regular;

    for (var i = 0; i < items.length; i += 1) {
      var raw = withAutoSerialIfNeeded(i, items[i]);
      var parsed = splitTagLabel(raw);
      var text = parsed.label ? parsed.label + parsed.body : raw;
      var lines = splitTextByWidth(ctx, text, width);
      var rows = drawLinesWithMaxY(ctx, lines, x, y, lineHeight, maxY);
      y = rows.nextY;

      if (rows.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiangxiangCompare(
    ctx,
    pairs,
    x,
    startY,
    width,
    maxY,
    lineHeight,
    itemGap,
    fonts,
    colors
  ) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i];
      var normal = sanitizeText(pair.normal);
      var better = sanitizeText(pair.better);

      if (normal) {
        ctx.fillStyle = colors.textPrimary || "#1C1C1C";
        ctx.font = fonts.regular;
        var normalLines = splitTextByWidth(ctx, withAutoSerialIfNeeded(i, normal), width);
        var normalRows = drawLinesWithMaxY(ctx, normalLines, x, y, lineHeight, maxY);
        y = normalRows.nextY;
        if (normalRows.truncated) {
          truncated = true;
          break;
        }
      }

      if (better) {
        ctx.fillStyle = colors.textSecondary || colors.textPrimary || "#1C1C1C";
        ctx.font = fonts.regular;
        var betterLines = splitTextByWidth(ctx, "优化：" + better, width);
        var betterRows = drawLinesWithMaxY(ctx, betterLines, x, y, lineHeight, maxY);
        y = betterRows.nextY;
        if (betterRows.truncated) {
          truncated = true;
          break;
        }
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < pairs.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawXiangxiangAutoText(ctx, text, x, startY, width, maxY, lineHeight, fonts, colors) {
    ctx.fillStyle = colors.textPrimary || "#1C1C1C";
    ctx.font = fonts.regular;
    var lines = splitTextByWidth(ctx, sanitizeText(text), width);
    var rows = drawLinesWithMaxY(ctx, lines, x, startY, lineHeight, maxY);
    return { truncated: rows.truncated };
  }

  function drawRifuPage(ctx, group, page, finalType, warnings) {
    var profile = group.profile;
    var colors = profile.colors || {};
    var typography = profile.typography || {};
    var layout = profile.layout.page || {};
    var family = typography.fontFamily || "'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif";
    var fonts = {
      regular:
        String(typography.bodyWeight || 500) + " " + String(typography.bodySize || 40) + "px " + family,
      lead:
        String(typography.leadWeight || 700) + " " + String(typography.bodySize || 40) + "px " + family
    };
    var titleText = sanitizeText(page.title);
    var titleSize = fitTextFontSize(
      ctx,
      titleText,
      layout.titleWidth,
      layout.titleMaxLines,
      typography.pageTitleSize || 54,
      42,
      String(typography.pageTitleWeight || 700),
      family
    );
    var result;

    ctx.fillStyle = colors.textPrimary || "#111111";
    ctx.font = String(typography.pageTitleWeight || 700) + " " + titleSize + "px " + family;
    drawWrappedLimited(
      ctx,
      titleText,
      layout.titleX,
      layout.titleY,
      layout.titleWidth,
      layout.titleLineHeight,
      layout.titleMaxLines,
      null
    );

    if (finalType === "list") {
      result = drawRifuList(
        ctx,
        page.items,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else if (finalType === "tag") {
      var tagItems = page.tags.length > 0 ? page.tags : page.items;
      result = drawRifuTag(
        ctx,
        tagItems,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else if (finalType === "compare") {
      result = drawRifuCompare(
        ctx,
        page.comparePairs,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        layout.itemGap,
        fonts,
        colors
      );
    } else {
      result = drawRifuAutoText(
        ctx,
        page.text,
        layout.bodyX,
        layout.bodyY,
        layout.bodyWidth,
        layout.bodyMaxY,
        layout.itemLineHeight,
        fonts,
        colors
      );
    }

    if (result && result.truncated) {
      warnings.add(
        group.source +
          " 第 " +
          page.pageNumber +
          " 页内容超出高度，已截断。可减少条目或拆分更多页面。"
      );
    }
  }

  function drawRifuList(ctx, items, x, startY, width, maxY, lineHeight, itemGap, fonts, colors) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < items.length; i += 1) {
      var raw = withAutoSerialIfNeeded(i, items[i]);
      var parsed = splitHeadingAndBody(raw);
      var lead = parsed.body ? parsed.heading : "";
      var body = parsed.body ? parsed.body : raw;
      var block = drawRifuLeadBodyBlock(
        ctx,
        lead,
        body,
        x,
        y,
        width,
        maxY,
        lineHeight,
        fonts,
        colors.textPrimary || "#111111"
      );
      y = block.nextY;

      if (block.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawRifuTag(ctx, items, x, startY, width, maxY, lineHeight, itemGap, fonts, colors) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < items.length; i += 1) {
      var raw = withAutoSerialIfNeeded(i, items[i]);
      var parsedTag = splitTagLabel(raw);
      var lead = "";
      var body = raw;

      if (parsedTag.label) {
        lead = parsedTag.label;
        body = parsedTag.body;
      } else {
        var headingBody = splitHeadingAndBody(raw);
        if (headingBody.body) {
          lead = headingBody.heading;
          body = headingBody.body;
        }
      }

      var block = drawRifuLeadBodyBlock(
        ctx,
        lead,
        body,
        x,
        y,
        width,
        maxY,
        lineHeight,
        fonts,
        colors.textPrimary || "#111111"
      );
      y = block.nextY;

      if (block.truncated) {
        truncated = true;
        break;
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < items.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawRifuCompare(
    ctx,
    pairs,
    x,
    startY,
    width,
    maxY,
    lineHeight,
    itemGap,
    fonts,
    colors
  ) {
    var y = startY;
    var truncated = false;

    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i];
      var normal = sanitizeText(pair.normal);
      var better = sanitizeText(pair.better);

      if (normal) {
        var normalBlock = drawRifuLeadBodyBlock(
          ctx,
          "普通：",
          normal,
          x,
          y,
          width,
          maxY,
          lineHeight,
          fonts,
          colors.textPrimary || "#111111"
        );
        y = normalBlock.nextY;
        if (normalBlock.truncated) {
          truncated = true;
          break;
        }
      }

      if (better) {
        var betterBlock = drawRifuLeadBodyBlock(
          ctx,
          "优化：",
          better,
          x,
          y,
          width,
          maxY,
          lineHeight,
          fonts,
          colors.textSecondary || colors.textPrimary || "#111111"
        );
        y = betterBlock.nextY;
        if (betterBlock.truncated) {
          truncated = true;
          break;
        }
      }

      y += itemGap;
      if (y > maxY) {
        truncated = i < pairs.length - 1;
        break;
      }
    }

    return { truncated: truncated };
  }

  function drawRifuAutoText(ctx, text, x, startY, width, maxY, lineHeight, fonts, colors) {
    ctx.fillStyle = colors.textPrimary || "#111111";
    ctx.font = fonts.regular;
    var lines = splitTextByWidth(ctx, sanitizeText(text), width);
    var rows = drawLinesWithMaxY(ctx, lines, x, startY, lineHeight, maxY);
    return { truncated: rows.truncated };
  }

  function drawRifuLeadBodyBlock(
    ctx,
    lead,
    body,
    x,
    startY,
    width,
    maxY,
    lineHeight,
    fonts,
    color
  ) {
    var leadText = sanitizeText(lead);
    var bodyText = sanitizeText(body);

    if (!leadText && !bodyText) {
      return {
        nextY: startY,
        truncated: false
      };
    }

    ctx.fillStyle = color;

    if (!leadText) {
      ctx.font = fonts.regular;
      return drawLinesWithMaxY(ctx, splitTextByWidth(ctx, bodyText, width), x, startY, lineHeight, maxY);
    }

    if (!bodyText) {
      ctx.font = fonts.lead;
      return drawLinesWithMaxY(ctx, splitTextByWidth(ctx, leadText, width), x, startY, lineHeight, maxY);
    }

    if (startY > maxY) {
      return {
        nextY: startY,
        truncated: true
      };
    }

    ctx.font = fonts.lead;
    var leadWidth = ctx.measureText(leadText).width;
    var firstBodyWidth = Math.max(80, width - leadWidth - 8);

    ctx.font = fonts.regular;
    var firstBodyLine = takeLineByWidth(ctx, bodyText, firstBodyWidth);
    var restBody = sanitizeText(bodyText.slice(firstBodyLine.length));

    ctx.font = fonts.lead;
    ctx.fillText(leadText, x, startY);

    ctx.font = fonts.regular;
    if (firstBodyLine) {
      ctx.fillText(firstBodyLine, x + leadWidth + 8, startY);
    }

    var nextY = startY + lineHeight;
    if (!restBody) {
      return {
        nextY: nextY,
        truncated: false
      };
    }

    var rows = drawLinesWithMaxY(ctx, splitTextByWidth(ctx, restBody, width), x, nextY, lineHeight, maxY);
    return {
      nextY: rows.nextY,
      truncated: rows.truncated
    };
  }

  function fitTextFontSize(ctx, text, maxWidth, maxLines, startSize, minSize, weight, family) {
    var size = startSize;
    while (size > minSize) {
      ctx.font = weight + " " + size + "px " + family;
      if (splitTextByWidth(ctx, text, maxWidth).length <= maxLines) {
        return size;
      }
      size -= 2;
    }
    return minSize;
  }

  function drawDefaultCover(ctx, group, groupIndex) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundedRect(ctx, 80, 110, 920, 1220, 48, true, false);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 86px 'Noto Serif SC', 'PingFang SC', serif";
    drawMultilineCentered(ctx, group.coverTitle, CANVAS_WIDTH / 2, 560, 780, 114, 4);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 34px 'Noto Serif SC', 'PingFang SC', serif";
    ctx.fillText("style: " + group.style + " | source: " + group.source, 130, 1180);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "500 28px 'Noto Serif SC', 'PingFang SC', serif";
    ctx.fillText("Group " + (groupIndex + 1), 130, 1240);
  }

  function drawDefaultPage(ctx, page, finalType, pageIndex, totalPages) {
    ctx.fillStyle = "rgba(255,255,255,0.84)";
    roundedRect(ctx, 64, 72, 952, 1296, 42, true, false);

    ctx.fillStyle = "#1f2b3b";
    ctx.font = "800 54px 'Noto Serif SC', 'PingFang SC', serif";
    drawMultiline(ctx, page.title || "Untitled", 110, 170, 860, 72, 2);

    ctx.fillStyle = "rgba(28,43,68,0.14)";
    roundedRect(ctx, 820, 94, 160, 54, 24, true, false);
    ctx.fillStyle = "#304567";
    ctx.font = "700 24px 'Noto Serif SC', 'PingFang SC', serif";
    ctx.fillText(pageIndex + "/" + totalPages, 866, 130);

    if (finalType === "list") {
      drawDefaultListLayout(ctx, page.items);
    } else if (finalType === "tag") {
      drawDefaultTagLayout(ctx, page.tags);
    } else if (finalType === "compare") {
      drawDefaultCompareLayout(ctx, page);
    } else {
      drawDefaultAutoLayout(ctx, page);
    }
  }

  function drawDefaultAutoLayout(ctx, page) {
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    roundedRect(ctx, 100, 330, 880, 920, 30, true, false);
    ctx.fillStyle = "#1f2939";
    ctx.font = "500 40px 'Noto Serif SC', 'PingFang SC', serif";
    drawParagraph(ctx, page.text || "(empty)", 140, 408, 800, 58, 13);
  }

  function drawDefaultListLayout(ctx, items) {
    var y = 330;
    var maxRows = Math.min(items.length, 10);

    for (var i = 0; i < maxRows; i += 1) {
      var itemText = sanitizeText(items[i]);
      var itemHasSerial = hasLeadingSerial(itemText);

      ctx.fillStyle = "rgba(255,255,255,0.62)";
      roundedRect(ctx, 100, y, 880, 92, 22, true, false);
      ctx.fillStyle = "#1e2838";
      ctx.font = "500 32px 'Noto Serif SC', 'PingFang SC', serif";

      if (itemHasSerial) {
        drawMultiline(ctx, itemText, 140, y + 54, 818, 42, 2);
      } else {
        ctx.fillStyle = "#234b75";
        ctx.font = "700 34px 'Noto Serif SC', 'PingFang SC', serif";
        ctx.fillText(String(i + 1), 140, y + 58);
        ctx.fillStyle = "#1e2838";
        ctx.font = "500 32px 'Noto Serif SC', 'PingFang SC', serif";
        drawMultiline(ctx, itemText, 198, y + 54, 760, 42, 2);
      }

      y += 110;
    }
  }
  function drawDefaultTagLayout(ctx, tags) {
    var x = 110;
    var y = 350;
    var maxWidth = 860;
    var rowHeight = 86;
    var limit = Math.min(tags.length, 24);

    for (var i = 0; i < limit; i += 1) {
      var tag = tags[i];
      var width = Math.min(320, Math.max(150, 48 + measureTextWidth("600 32px 'Noto Serif SC'", tag)));
      if (x + width > 110 + maxWidth) {
        x = 110;
        y += rowHeight;
      }

      ctx.fillStyle = "rgba(255,255,255,0.76)";
      roundedRect(ctx, x, y, width, 62, 30, true, false);
      ctx.fillStyle = "#29496f";
      ctx.font = "600 32px 'Noto Serif SC', 'PingFang SC', serif";
      ctx.fillText(tag, x + 24, y + 42);
      x += width + 16;
    }
  }

  function drawDefaultCompareLayout(ctx, page) {
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    roundedRect(ctx, 96, 320, 420, 920, 30, true, false);
    roundedRect(ctx, 564, 320, 420, 920, 30, true, false);

    ctx.fillStyle = "#1b436d";
    ctx.font = "700 34px 'Noto Serif SC', 'PingFang SC', serif";
    drawMultilineCentered(ctx, page.leftTitle || "A", 306, 385, 360, 44, 2);
    drawMultilineCentered(ctx, page.rightTitle || "B", 774, 385, 360, 44, 2);

    drawBulletList(ctx, page.left, 130, 455, 350, 52, 13);
    drawBulletList(ctx, page.right, 598, 455, 350, 52, 13);
  }

  function drawBulletList(ctx, items, x, y, width, lineHeight, maxRows) {
    ctx.fillStyle = "#1d2b3f";
    ctx.font = "500 30px 'Noto Serif SC', 'PingFang SC', serif";

    var rows = 0;
    for (var i = 0; i < items.length && rows < maxRows; i += 1) {
      var lines = splitTextByWidth(ctx, "• " + items[i], width);
      for (var j = 0; j < lines.length && rows < maxRows; j += 1) {
        ctx.fillText(lines[j], x, y + rows * lineHeight);
        rows += 1;
      }
      rows += 0.4;
    }
  }

  function drawParagraph(ctx, text, x, y, maxWidth, lineHeight, maxRows) {
    ctx.fillStyle = "#1f2a39";
    var lines = splitTextByWidth(ctx, text, maxWidth);
    var limit = Math.min(lines.length, maxRows);
    for (var i = 0; i < limit; i += 1) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  function drawMultiline(ctx, text, x, y, maxWidth, lineHeight, maxRows) {
    var lines = splitTextByWidth(ctx, text, maxWidth);
    var count = Math.min(lines.length, maxRows);
    for (var i = 0; i < count; i += 1) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  function drawMultilineCentered(ctx, text, centerX, y, maxWidth, lineHeight, maxRows) {
    var lines = splitTextByWidth(ctx, text, maxWidth);
    var count = Math.min(lines.length, maxRows);
    for (var i = 0; i < count; i += 1) {
      var line = lines[i];
      var width = ctx.measureText(line).width;
      ctx.fillText(line, centerX - width / 2, y + i * lineHeight);
    }
  }

  function drawWrappedLimited(ctx, text, x, y, maxWidth, lineHeight, maxLines, maxY) {
    var lines = splitTextByWidth(ctx, text, maxWidth);
    var count = Math.min(lines.length, maxLines);

    for (var i = 0; i < count; i += 1) {
      var lineY = y + i * lineHeight;
      if (typeof maxY === "number" && lineY > maxY) {
        break;
      }
      ctx.fillText(lines[i], x, lineY);
    }
  }

  function drawLinesWithMaxY(ctx, lines, x, y, lineHeight, maxY) {
    var currentY = y;
    var truncated = false;

    for (var i = 0; i < lines.length; i += 1) {
      if (currentY > maxY) {
        truncated = true;
        break;
      }
      ctx.fillText(lines[i], x, currentY);
      currentY += lineHeight;
    }

    return {
      nextY: currentY,
      truncated: truncated
    };
  }

  function splitTextByWidth(ctx, text, maxWidth) {
    var source = String(text == null ? "" : text).replace(/\r/g, "");
    if (!source) {
      return [""];
    }

    var paragraphs = source.split("\n");
    var lines = [];

    for (var p = 0; p < paragraphs.length; p += 1) {
      var paragraph = paragraphs[p];
      if (paragraph.length === 0) {
        lines.push("");
        continue;
      }

      var current = "";
      for (var i = 0; i < paragraph.length; i += 1) {
        var next = current + paragraph[i];
        if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
          current = next;
        } else {
          lines.push(current);
          current = paragraph[i];
        }
      }

      if (current) {
        lines.push(current);
      }
    }

    return lines;
  }

  function takeLineByWidth(ctx, text, maxWidth) {
    var source = String(text == null ? "" : text).replace(/\r/g, "");
    if (!source) {
      return "";
    }

    var limit = Math.max(1, maxWidth);
    var current = "";

    for (var i = 0; i < source.length; i += 1) {
      var ch = source[i];
      if (ch === "\n") {
        break;
      }

      var next = current + ch;
      if (ctx.measureText(next).width <= limit || current.length === 0) {
        current = next;
      } else {
        break;
      }
    }

    return current;
  }

  function splitHeadingAndBody(text) {
    var raw = sanitizeText(text);
    if (!raw) {
      return { heading: "", body: "" };
    }

    // Only treat explicit "标题：正文" structures as heading-body blocks.
    // Full sentences like "我没有偏袒你，只是..." should stay regular (no bold lead).
    var separators = [":", "："];
    for (var i = 0; i < separators.length; i += 1) {
      var idx = raw.indexOf(separators[i]);
      if (idx >= 2 && idx <= 22) {
        var body = raw.slice(idx + 1).trim();
        if (!body) {
          continue;
        }
        return {
          heading: raw.slice(0, idx + 1),
          body: body
        };
      }
    }

    return {
      heading: raw,
      body: ""
    };
  }

  function splitTagLabel(text) {
    var raw = sanitizeText(text);
    var match = raw.match(/^(【[^】]+】)(.*)$/);
    if (!match) {
      return { label: "", body: raw };
    }

    return {
      label: sanitizeText(match[1]),
      body: sanitizeText(match[2])
    };
  }
  function ensureQuotedTitle(title) {
    var raw = sanitizeText(title);
    if (!raw) {
      return "";
    }

    if (/[“”"']/u.test(raw)) {
      return raw;
    }

    return "“" + raw + "”";
  }

  function stripOuterQuotes(text) {
    var raw = sanitizeText(text);
    if (!raw) {
      return "";
    }

    return raw
      .replace(/^["'“”‘’]+/, "")
      .replace(/["'“”‘’]+$/, "")
      .trim();
  }

  function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();

    if (fill) {
      ctx.fill();
    }
    if (stroke) {
      ctx.stroke();
    }
  }

  function measureTextWidth(font, text) {
    var canvas = document.createElement("canvas");
    var c = canvas.getContext("2d");
    c.font = font;
    return c.measureText(String(text || "")).width;
  }

  function inferAutoType(page) {
    if (page.comparePairs.length > 0 || (page.left.length > 0 && page.right.length > 0)) {
      return "compare";
    }
    if (page.tags.length > 0) {
      return "tag";
    }
    if (page.items.length > 0) {
      return "list";
    }
    if (page.text) {
      return "auto";
    }
    return "auto";
  }

  function mapStyleAlias(input) {
    var raw = String(input || "").trim();
    if (!raw) {
      return null;
    }

    var lower = raw.toLowerCase();
    return STYLE_ALIAS[raw] || STYLE_ALIAS[lower] || null;
  }

  function normalizeDoubaoLayoutStyle(input) {
    var mapped = mapStyleAlias(input);
    if (mapped && STYLE_PROFILES[mapped]) {
      return mapped;
    }
    return DOUBAO_DEFAULT_LAYOUT_STYLE;
  }

  function mapPageType(input) {
    var normalized = String(input || "")
      .trim()
      .toLowerCase();

    return PAGE_TYPES.indexOf(normalized) >= 0 ? normalized : null;
  }

  function sanitizeText(input) {
    return String(input == null ? "" : input).trim();
  }

  function parseLeadingSerial(text) {
    var raw = sanitizeText(text);
    var match = raw.match(/^[（(【\[]?\s*(\d{1,4})\s*(?:[、，,\.．。:：]|[)）]|\s)\s*/);
    if (!match) {
      return null;
    }

    return {
      number: parseInt(match[1], 10),
      endIndex: match[0].length
    };
  }

  function hasLeadingSerial(text) {
    return !!parseLeadingSerial(text);
  }

  function withAutoSerialIfNeeded(index, text) {
    var raw = sanitizeText(text);
    if (!raw) {
      return "";
    }
    return raw;
  }

  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(function (item) {
        return sanitizeText(item);
      })
      .filter(Boolean);
  }

  function canvasToJpeg(canvas) {
    try {
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch (error) {
      throw new Error("JPEG 导出失败（可能遇到浏览器安全限制）：" + toErrorMessage(error));
    }
  }

  function loadImage(src) {
    if (imageCache.has(src)) {
      return imageCache.get(src);
    }

    var task = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("背景图加载失败。"));
      };
      img.src = src;
    });

    imageCache.set(src, task);
    return task;
  }

  function renderResults(groups) {
    refs.resultList.innerHTML = "";
    for (var i = 0; i < groups.length; i += 1) {
      refs.resultList.appendChild(createGroupNode(groups[i], i + 1));
    }
  }

  function createGroupNode(result, index) {
    var wrapper = document.createElement("article");
    wrapper.className = "result-group";

    var header = document.createElement("div");
    header.className = "group-header";

    var title = document.createElement("h3");
    title.className = "group-title";
    title.textContent =
      "第 " + index + " 组：" + result.group.coverTitle + "（共 " + result.images.length + " 张）";

    var downloadAllBtn = document.createElement("button");
    downloadAllBtn.type = "button";
    downloadAllBtn.className = "btn btn-primary";
    downloadAllBtn.textContent = "下载本组 JPEG";
    downloadAllBtn.addEventListener("click", function () {
      batchDownload(result.images, slugify(result.group.coverTitle || "xhs-group"));
    });

    header.appendChild(title);
    header.appendChild(downloadAllBtn);
    wrapper.appendChild(header);

    var grid = document.createElement("div");
    grid.className = "thumb-grid";

    for (var i = 0; i < result.images.length; i += 1) {
      var image = result.images[i];
      var figure = document.createElement("figure");
      figure.className = "thumb";

      var img = document.createElement("img");
      img.src = image.url;
      img.alt = image.label;

      var caption = document.createElement("figcaption");
      var label = document.createElement("span");
      label.textContent = image.label;

      var oneBtn = document.createElement("button");
      oneBtn.type = "button";
      oneBtn.className = "btn btn-ghost";
      oneBtn.textContent = "下载";
      var oneFileName =
        slugify(result.group.coverTitle || "xhs") + "_" + String(i + 1).padStart(2, "0") + ".jpg";
      oneBtn.setAttribute("data-file-name", oneFileName);
      oneBtn.addEventListener(
        "click",
        (function (fileName, dataUrl) {
          return function () {
            downloadDataUrl(dataUrl, fileName);
          };
        })(
          oneFileName,
          image.url
        )
      );

      caption.appendChild(label);
      caption.appendChild(oneBtn);
      figure.appendChild(img);
      figure.appendChild(caption);
      grid.appendChild(figure);
    }

    wrapper.appendChild(grid);
    return wrapper;
  }

  function batchDownload(images, prefix) {
    for (var i = 0; i < images.length; i += 1) {
      (function (idx) {
        setTimeout(function () {
          var fileName = prefix + "_" + String(idx + 1).padStart(2, "0") + ".jpg";
          downloadDataUrl(images[idx].url, fileName);
        }, idx * 120);
      })(i);
    }
  }

  function downloadDataUrl(dataUrl, filename) {
    var link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function slugify(text) {
    var value = String(text || "xhs-render")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return value || "xhs-render";
  }

  function readStorage(key) {
    try {
      return String(window.localStorage.getItem(key) || "");
    } catch (error) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, String(value || ""));
    } catch (error) {
      return;
    }
  }

  function clearMessages() {
    refs.errorBox.style.display = "none";
    refs.errorBox.innerHTML = "";
    refs.warningBox.style.display = "none";
    refs.warningBox.innerHTML = "";
  }

  function showErrors(items) {
    refs.errorBox.style.display = "block";
    refs.errorBox.innerHTML = "<strong>错误</strong><br>" + items.join("<br>");
  }

  function showWarnings(items) {
    refs.warningBox.style.display = "block";
    refs.warningBox.innerHTML = "<strong>提示</strong><br>" + items.join("<br>");
  }

  function setStatus(text) {
    refs.statusBox.textContent = text;
    refs.statusBox.classList.remove("muted");
  }

  function toErrorMessage(error) {
    if (!error) {
      return "未知错误";
    }
    return error.message ? error.message : String(error);
  }
})();


