import { CommandCompletionManager } from '../commands/CommandCompletionManager';
import { SkillManager } from '../skills/SkillManager';

describe('CommandCompletionManager', () => {
  let manager: CommandCompletionManager;

  beforeAll(() => {
    const skillManager = SkillManager.getInstance();
    skillManager.loadBuiltInSkills();
  });

  beforeEach(() => {
    manager = CommandCompletionManager.getInstance();
  });

  describe('getAllSuggestions', () => {
    it('should return all commands when input is "/"', () => {
      const suggestions = manager.getAllSuggestions('/');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.command === '/help')).toBe(true);
      expect(suggestions.some(s => s.command === '/clear')).toBe(true);
      expect(suggestions.some(s => s.command === '/provider')).toBe(true);
    });

    it('should return all commands when input is empty', () => {
      const suggestions = manager.getAllSuggestions('');
      
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should filter commands based on input', () => {
      const suggestions = manager.getAllSuggestions('/help');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => 
        s.command.toLowerCase().includes('help') || 
        s.description.toLowerCase().includes('help')
      )).toBe(true);
    });

    it('should include system commands', () => {
      const suggestions = manager.getAllSuggestions('/');
      const systemCommands = suggestions.filter(s => s.category === 'system');
      
      expect(systemCommands.length).toBeGreaterThan(0);
      expect(systemCommands.some(s => s.command === '/help')).toBe(true);
      expect(systemCommands.some(s => s.command === '/clear')).toBe(true);
    });

    it('should include built-in skills', () => {
      const suggestions = manager.getAllSuggestions('/');
      const skillCommands = suggestions.filter(s => s.category === 'skill');
      
      expect(skillCommands.length).toBeGreaterThan(0);
      expect(skillCommands.some(s => s.command.includes('remember'))).toBe(true);
    });

    it('should return case-insensitive results', () => {
      const lowerSuggestions = manager.getAllSuggestions('/HELP');
      const upperSuggestions = manager.getAllSuggestions('/help');
      
      expect(lowerSuggestions.length).toBe(upperSuggestions.length);
    });
  });

  describe('getSkillSuggestions', () => {
    it('should return all skills when query is empty', () => {
      const suggestions = manager.getSkillSuggestions('');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.category === 'skill')).toBe(true);
    });

    it('should filter skills based on query', () => {
      const suggestions = manager.getSkillSuggestions('remember');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.command.includes('remember'))).toBe(true);
    });

    it('should include fullCommand property', () => {
      const suggestions = manager.getSkillSuggestions('');
      
      suggestions.forEach(s => {
        expect(s.fullCommand).toBeDefined();
        expect(s.fullCommand).toContain('/skill');
      });
    });
  });

  describe('command structure', () => {
    it('should have required properties for each suggestion', () => {
      const suggestions = manager.getAllSuggestions('/');
      
      suggestions.forEach(s => {
        expect(s.command).toBeDefined();
        expect(typeof s.command).toBe('string');
        expect(s.description).toBeDefined();
        expect(typeof s.description).toBe('string');
        expect(s.category).toBeDefined();
        expect(['skill', 'system', 'custom']).toContain(s.category);
      });
    });

    it('should have non-empty descriptions', () => {
      const suggestions = manager.getAllSuggestions('/');
      
      suggestions.forEach(s => {
        expect(s.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('refresh', () => {
    it('should reload custom skills', () => {
      const beforeRefresh = manager.getAllSuggestions('/');
      manager.refresh();
      const afterRefresh = manager.getAllSuggestions('/');
      
      expect(afterRefresh.length).toBeGreaterThanOrEqual(beforeRefresh.length);
    });
  });
});
