import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic, { Anthropic as AnthropicType } from '@anthropic-ai/sdk';
import { getApiKey } from '../routes/apiKeys';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
}

export interface ArticleExtraction {
  title?: string;
  content: string;
  summary: string;
  articleType?: string;
  author?: string;
  images?: Array<{ url: string; description: string }>;
  events?: Array<{
    type: string;
    date?: string;
    title: string;
    description: string;
  }>;
}

export class AIService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private anthropic: AnthropicType | null = null;

  async initialize() {
    const openaiKey = await getApiKey('openai');
    const geminiKey = await getApiKey('gemini');
    const anthropicKey = await getApiKey('anthropic');

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }
  }

  async extractTextFromImage(imagePath: string): Promise<OCRResult> {
    await this.initialize();

    // Try OpenAI first, then Gemini, then Claude
    if (this.openai) {
      try {
        return await this.extractWithOpenAI(imagePath);
      } catch (error) {
        logger.warn('OpenAI OCR failed, trying Gemini:', error);
      }
    }

    if (this.gemini) {
      try {
        return await this.extractWithGemini(imagePath);
      } catch (error) {
        logger.warn('Gemini OCR failed, trying Claude:', error);
      }
    }

    if (this.anthropic) {
      try {
        return await this.extractWithClaude(imagePath);
      } catch (error) {
        logger.error('All OCR services failed:', error);
        throw new Error('All OCR services failed');
      }
    }

    throw new Error('No AI API keys configured');
  }

  private async extractWithOpenAI(imagePath: string): Promise<OCRResult> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 이미지는 한국어 교회 신문 페이지입니다. 이미지에서 모든 텍스트를 정확하게 추출해주세요. 한글 인코딩을 올바르게 처리해주세요.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content || '';
    return {
      text,
      confidence: 0.9,
      language: 'ko',
    };
  }

  private async extractWithGemini(imagePath: string): Promise<OCRResult> {
    if (!this.gemini) throw new Error('Gemini not initialized');

    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro-vision' });
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = '이 이미지는 한국어 교회 신문 페이지입니다. 이미지에서 모든 텍스트를 정확하게 추출해주세요. 한글 인코딩을 올바르게 처리해주세요.';

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const text = result.response.text();
    return {
      text,
      confidence: 0.9,
      language: 'ko',
    };
  }

  private async extractWithClaude(imagePath: string): Promise<OCRResult> {
    if (!this.anthropic) throw new Error('Anthropic not initialized');

    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Use type assertion for Anthropic SDK compatibility
    const anthropicClient = this.anthropic as any;
    const message = await anthropicClient.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: '이 이미지는 한국어 교회 신문 페이지입니다. 이미지에서 모든 텍스트를 정확하게 추출해주세요. 한글 인코딩을 올바르게 처리해주세요.',
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return {
      text,
      confidence: 0.9,
      language: 'ko',
    };
  }

  async extractArticleFromText(text: string, pageNumber: number): Promise<ArticleExtraction> {
    await this.initialize();

    const prompt = `다음은 교회 신문 페이지 ${pageNumber}의 OCR 추출 텍스트입니다. 다음 형식의 JSON으로 응답해주세요:

{
  "title": "기사 제목",
  "content": "전체 기사 내용",
  "summary": "기사 내용 요약 (행사, 간증, 선교, 말씀, 컬럼, 샘물, 절기, 수련회, 양육프로그램, 성찬식, 세례식, 장례식, 찬양, 교회학교, 청년부, 부흥회, 특별새벽기도회, 큐티 등 중 분류)",
  "articleType": "기사 유형 (행사, 간증, 선교, 말씀, 컬럼, 샘물, 절기, 수련회, 양육프로그램, 성찬식, 세례식, 장례식, 찬양, 교회학교, 청년부, 부흥회, 특별새벽기도회, 큐티 등)",
  "author": "글쓴이 또는 기자 이름",
  "events": [
    {
      "type": "이벤트 유형",
      "date": "YYYY-MM-DD 형식의 날짜 (있는 경우)",
      "title": "이벤트 제목",
      "description": "이벤트 설명"
    }
  ]
}

OCR 텍스트:
${text}`;

    if (this.openai) {
      try {
        return await this.extractWithOpenAIText(prompt);
      } catch (error) {
        logger.warn('OpenAI extraction failed, trying Gemini:', error);
      }
    }

    if (this.gemini) {
      try {
        return await this.extractWithGeminiText(prompt);
      } catch (error) {
        logger.warn('Gemini extraction failed, trying Claude:', error);
      }
    }

    if (this.anthropic) {
      try {
        return await this.extractWithClaudeText(prompt);
      } catch (error) {
        logger.error('All extraction services failed:', error);
        throw new Error('All extraction services failed');
      }
    }

    throw new Error('No AI API keys configured');
  }

  private async extractWithOpenAIText(prompt: string): Promise<ArticleExtraction> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  private async extractWithGeminiText(prompt: string): Promise<ArticleExtraction> {
    if (!this.gemini) throw new Error('Gemini not initialized');

    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt + '\n\nJSON 형식으로 응답해주세요.');
    const content = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from Gemini response');
  }

  private async extractWithClaudeText(prompt: string): Promise<ArticleExtraction> {
    if (!this.anthropic) throw new Error('Anthropic not initialized');

    // Use type assertion for Anthropic SDK compatibility
    const anthropicClient = this.anthropic as any;
    const message = await anthropicClient.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt + '\n\nJSON 형식으로 응답해주세요.',
        },
      ],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from Claude response');
  }
}

export const aiService = new AIService();

