import { aiService } from './aiService';
import { cleanTextForQuiz } from '../quiz/generator';

export interface CardExplanationInput {
  cardId: string;
  front: string;
  back?: string;
  deckName?: string;
  noteTypeName?: string;
  fields?: Record<string, string>;
  forceRefresh?: boolean;
}

export const cardExplainer = {
  /**
   * Generates a context-aware AI explanation tailored to the card type (vocabulary, concept, equation, code, etc.)
   */
  async explainCard(input: CardExplanationInput): Promise<string> {
    const cleanFront = cleanTextForQuiz(input.front);
    const cleanBack = input.back ? cleanTextForQuiz(input.back) : '';

    // Extract all fields if available
    let fieldsContext = '';
    if (input.fields && Object.keys(input.fields).length > 0) {
      const parts: string[] = [];
      for (const [key, val] of Object.entries(input.fields)) {
        const cleaned = cleanTextForQuiz(val);
        if (cleaned) {
          parts.push(`${key}: ${cleaned}`);
        }
      }
      fieldsContext = parts.join('\n');
    }

    const systemPrompt = `أنت مساعد الدراسة الأكاديمي والذكي داخل تطبيق البطاقات التعليمية (Flashcards).
مهمتك: تقديم تفكيك وشرح تعليمي عميق للبطاقة الحالية لترسيخها في ذهن المتعلم.

أولاً: حلل محتوى البطاقة واكتشف بنفسك نوعها ومجالها تلقائياً:

1. إذا كانت البطاقة "مفردة أو مصطلحاً لغوياً" (مثل كلمة إنجليزية أو لغة أجنبية):
التزم بدقة بالهيكل التالي:
الكلمة: [الكلمة الأصلية]
1. جميع المعاني باللغة العربية (مرتبة حسب الأكثر استخداماً):
- [المعنى بالعربية]: ([نوع الكلمة: فعل / اسم / صفة]) [شرح موجز ودقيق للمعنى والسياق].
2. أشهر التراكيب والمصطلحات (Common Collocations):
- [التركيب بالأجنبية]: [ترجمته واستخدامه الشائع].
3. أمثلة واقعية متنوعة:
- "[الجملة الأصلية]" ([الترجمة العربية الدقيقة]).
4. دليل النطق وموضع النبرة:
- الرمز الصوتي (IPA): [الرمز الصوتي الدقيق]
- التقطيع الصوتي وموضع النبرة: [عدد المقاطع، موضع النبرة، ووصف نطق الأصوات الصعبة].
5. في نهاية الإجابة، اعرض مثالاً تطبيقياً إضافياً وسؤالاً قصيراً لتحليله.

2. إذا كانت البطاقة "مفهوماً علمياً أو طبياً":
- الشرح الجوهري والمبسط للمفهوم
- مثال أو تشبيه واقعي
- خطأ شائع في الفهم (Common Misconception)
- سؤال تحقق سريع للذاكرة

3. إذا كانت البطاقة "معادلة رياضية أو فيزيائية":
- دلالة كل رمز ووحدات القياس
- متى وكيف تُستخدم
- مثال تطبيقي محلول خطوة بخطوة

4. إذا كانت البطاقة "حدثاً تاريخياً":
- السياق التاريخي والأسباب والنتائج
- الرابط بما قبله وما بعده
- نقطة ارتكاز لتذكر التاريخ والأشخاص

5. إذا كانت البطاقة "كوداً برمجياً":
- شرح منطق الكود بدقة
- كود بديل أو طريقة أكثر كفاءة
- خطأ برمجي شائع لتجنبه (Common Bug / Gotcha)

6. لأي نوع آخر من البطاقات:
- تفكيك السؤال والإجابة، وشرح الرابط الذهني الذي يضمن تذكرها.

تنبيه هام حول الأسلوب:
- لا تستخدم أي رموز تعبيرية (إيموجيز) من الكيبورد نهائياً. اعتمد كلياً على التنسيق النظيف، العناوين، والنقاط المرتبة.
- اكتب بلغة عربية سليمة وواضحة جداً.`;

    const userContent = `معلومات البطاقة الحالية:
${input.deckName ? `الرزمة: ${input.deckName}\n` : ''}${input.noteTypeName ? `نوع الملاحظة: ${input.noteTypeName}\n` : ''}الوجه الأمامي (السؤال):
${cleanFront}

${cleanBack ? `الوجه الخلفي (الإجابة):
${cleanBack}` : ''}
${fieldsContext ? `\nتفاصيل الحقول الإضافية:\n${fieldsContext}` : ''}

يرجى تقديم الشرح والتحليل الأكاديمي المناسب وفق القواعد المحددة أعلاه.`;

    const response = await aiService.completeWithCache(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      {
        requestType: 'card_explanation',
        cardId: input.cardId,
        forceRefresh: input.forceRefresh,
        completionOptions: {
          temperature: 0.2,
          maxTokens: 2500,
        },
      }
    );

    return response.text;
  },
};
