import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SaveSystem {
  constructor(options = {}) {
    this.saveDirectory = options.saveDirectory || path.join(__dirname, '../../saves');
    this.autoSaveInterval = options.autoSaveInterval || 30000;
    this.maxBackups = options.maxBackups || 5;

    this.ensureSaveDirectory();
  }

  async ensureSaveDirectory() {
    try {
      await fs.access(this.saveDirectory);
    } catch {
      await fs.mkdir(this.saveDirectory, { recursive: true });
    }
  }

  async saveSession(session) {
    try {
      const filename = `session_${session.id}.json`;
      const filepath = path.join(this.saveDirectory, filename);

      const saveData = {
        session: session.toJSON(),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));

      await this.createBackup(filepath);

      return {
        success: true,
        filepath,
        timestamp: saveData.timestamp
      };

    } catch (error) {
      console.error('Error saving session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async loadSession(sessionId) {
    try {
      const filename = `session_${sessionId}.json`;
      const filepath = path.join(this.saveDirectory, filename);

      const data = await fs.readFile(filepath, 'utf8');
      const saveData = JSON.parse(data);

      return {
        success: true,
        session: saveData.session,
        timestamp: saveData.timestamp,
        version: saveData.version
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'Save file not found'
        };
      }

      console.error('Error loading session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteSession(sessionId) {
    try {
      const filename = `session_${sessionId}.json`;
      const filepath = path.join(this.saveDirectory, filename);

      await fs.unlink(filepath);

      await this.deleteBackups(sessionId);

      return {
        success: true,
        message: 'Session deleted successfully'
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'Save file not found'
        };
      }

      console.error('Error deleting session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listSessions() {
    try {
      const files = await fs.readdir(this.saveDirectory);
      const sessionFiles = files.filter(file => file.startsWith('session_') && file.endsWith('.json'));

      const sessions = [];

      for (const file of sessionFiles) {
        try {
          const filepath = path.join(this.saveDirectory, file);
          const data = await fs.readFile(filepath, 'utf8');
          const saveData = JSON.parse(data);

          const sessionId = file.replace('session_', '').replace('.json', '');

          sessions.push({
            sessionId,
            filename: file,
            lastSaved: saveData.timestamp,
            characterName: saveData.session.character?.name || 'Unknown',
            turnCount: saveData.session.turnCount || 0,
            currentScene: saveData.session.currentSceneId || 'unknown'
          });

        } catch (fileError) {
          console.error(`Error reading save file ${file}:`, fileError);
        }
      }

      sessions.sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved));

      return {
        success: true,
        sessions
      };

    } catch (error) {
      console.error('Error listing sessions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createBackup(originalFilepath) {
    try {
      const filename = path.basename(originalFilepath);
      const sessionId = filename.replace('session_', '').replace('.json', '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `backup_${sessionId}_${timestamp}.json`;
      const backupFilepath = path.join(this.saveDirectory, 'backups', backupFilename);

      await fs.mkdir(path.dirname(backupFilepath), { recursive: true });

      const data = await fs.readFile(originalFilepath, 'utf8');
      await fs.writeFile(backupFilepath, data);

      await this.cleanupOldBackups(sessionId);

    } catch (error) {
      console.error('Error creating backup:', error);
    }
  }

  async cleanupOldBackups(sessionId) {
    try {
      const backupDir = path.join(this.saveDirectory, 'backups');
      const files = await fs.readdir(backupDir);
      const sessionBackups = files
        .filter(file => file.startsWith(`backup_${sessionId}_`))
        .sort()
        .reverse();

      if (sessionBackups.length > this.maxBackups) {
        const filesToDelete = sessionBackups.slice(this.maxBackups);

        for (const file of filesToDelete) {
          await fs.unlink(path.join(backupDir, file));
        }
      }

    } catch (error) {
      console.error('Error cleaning up backups:', error);
    }
  }

  async deleteBackups(sessionId) {
    try {
      const backupDir = path.join(this.saveDirectory, 'backups');
      const files = await fs.readdir(backupDir);
      const sessionBackups = files.filter(file => file.startsWith(`backup_${sessionId}_`));

      for (const file of sessionBackups) {
        await fs.unlink(path.join(backupDir, file));
      }

    } catch (error) {
      console.error('Error deleting backups:', error);
    }
  }

  async exportSession(sessionId, format = 'json') {
    try {
      const loadResult = await this.loadSession(sessionId);
      if (!loadResult.success) {
        return loadResult;
      }

      let exportData;
      let filename;
      let contentType;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(loadResult, null, 2);
          filename = `session_${sessionId}_export.json`;
          contentType = 'application/json';
          break;

        case 'txt':
          exportData = this.formatSessionAsText(loadResult.session);
          filename = `session_${sessionId}_export.txt`;
          contentType = 'text/plain';
          break;

        default:
          return {
            success: false,
            error: 'Unsupported export format'
          };
      }

      return {
        success: true,
        data: exportData,
        filename,
        contentType
      };

    } catch (error) {
      console.error('Error exporting session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatSessionAsText(session) {
    const lines = [];

    lines.push('=== AGENTIC RPG SESSION EXPORT ===\n');
    lines.push(`Session ID: ${session.id}`);
    lines.push(`Player ID: ${session.playerId || 'Unknown'}`);
    lines.push(`Started: ${session.startedAt}`);
    lines.push(`Turn Count: ${session.turnCount}`);
    lines.push(`Difficulty: ${session.difficulty}\n`);

    if (session.character) {
      lines.push('=== CHARACTER ===');
      lines.push(`Name: ${session.character.name}`);
      lines.push(`Level: ${session.character.level}`);
      lines.push(`HP: ${session.character.hp.current}/${session.character.hp.max}`);
      lines.push(`Gold: ${session.character.resources.gold}\n`);

      lines.push('Abilities:');
      Object.entries(session.character.abilities).forEach(([ability, score]) => {
        const modifier = Math.floor((score - 10) / 2);
        lines.push(`  ${ability}: ${score} (${modifier >= 0 ? '+' : ''}${modifier})`);
      });
      lines.push('');

      if (session.character.inventory.length > 0) {
        lines.push('Inventory:');
        session.character.inventory.forEach(item => {
          lines.push(`  - ${typeof item === 'string' ? item : item.name}`);
        });
        lines.push('');
      }
    }

    lines.push(`Current Scene: ${session.currentSceneId || 'Unknown'}`);

    return lines.join('\n');
  }

  async getStorageStats() {
    try {
      const files = await fs.readdir(this.saveDirectory);
      const sessionFiles = files.filter(file => file.startsWith('session_') && file.endsWith('.json'));

      let totalSize = 0;
      for (const file of sessionFiles) {
        const stats = await fs.stat(path.join(this.saveDirectory, file));
        totalSize += stats.size;
      }

      const backupDir = path.join(this.saveDirectory, 'backups');
      let backupSize = 0;
      let backupCount = 0;

      try {
        const backupFiles = await fs.readdir(backupDir);
        backupCount = backupFiles.length;

        for (const file of backupFiles) {
          const stats = await fs.stat(path.join(backupDir, file));
          backupSize += stats.size;
        }
      } catch {
      }

      return {
        sessionCount: sessionFiles.length,
        totalSize: totalSize,
        backupCount: backupCount,
        backupSize: backupSize,
        saveDirectory: this.saveDirectory
      };

    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        error: error.message
      };
    }
  }
}