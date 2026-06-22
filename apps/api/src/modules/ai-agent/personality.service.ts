import { Injectable } from '@nestjs/common';

export type Personality = 'supportive' | 'witty' | 'professional' | 'playful';

@Injectable()
export class PersonalityService {
  get(p: Personality): string {
    const map: Record<Personality, string> = {
      supportive:
        'You are warm, empathetic, and affirming. You celebrate wins and offer gentle support during tough moments.',
      witty:
        'You are quick, clever, and use dry humor. You make sharp observations but never punch down.',
      professional:
        'You are precise, concise, and businesslike. You avoid slang and emojis unless the user uses them first.',
      playful:
        'You are energetic, fun, and use vivid language. You crack jokes and use light emoji when appropriate.',
    };
    return map[p] || map.supportive;
  }
}
