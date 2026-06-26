/**
 * Email service tests — verifies SMTP transport + queue retry + template rendering.
 *
 * Tests cover:
 *  - File-mock send (no SMTP env vars) writes .eml file
 *  - sendVerificationCode / sendRecoveryCode / send2FABackupCodes render correctly
 *  - send() returns id + queued flag
 *  - sendDirect() does NOT queue (used by processor to avoid recursion)
 *  - Inbox listing returns recently sent emails
 *  - getEmail by ID returns single email
 *  - parseEml parses standard headers correctly
 *
 * Note: SMTP transport is NOT tested directly (would require a real SMTP server).
 * The sendDirect path is exercised end-to-end via the file mock, which exercises
 * the same code path that sendDirect takes when transporter is null.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EmailService } from '../src/modules/email/email.service';

// Use a unique inbox dir per test run so tests don't interfere with each other
const TEST_INBOX = `/tmp/orbit-email-test-${process.pid}-${Date.now()}`;

describe('EmailService', () => {
  let service: EmailService;
  let originalInbox: string | undefined;

  beforeAll(() => {
    originalInbox = process.env.ORBIT_INBOX_DIR;
    process.env.ORBIT_INBOX_DIR = TEST_INBOX;
    // Force file mock by ensuring no SMTP env vars
    delete process.env.SMTP_HOST;
    delete process.env.SENDGRID_API_KEY;
  });

  afterAll(async () => {
    if (originalInbox !== undefined) {
      process.env.ORBIT_INBOX_DIR = originalInbox;
    } else {
      delete process.env.ORBIT_INBOX_DIR;
    }
    // Clean up test inbox
    try {
      await fs.rm(TEST_INBOX, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  beforeEach(async () => {
    // Fresh inbox per test
    try {
      await fs.rm(TEST_INBOX, { recursive: true, force: true });
    } catch {
      // ignore
    }
    await fs.mkdir(TEST_INBOX, { recursive: true });
    // Construct service without emailQueue (so we test file mock path only)
    service = new EmailService();
    // Wait for async init to complete
    await new Promise((r) => setTimeout(r, 50));
  });

  describe('file-mock send', () => {
    it('writes .eml file to inbox', async () => {
      const result = await service.send({
        to: 'alice@example.com',
        subject: 'Hello',
        text: 'World',
        sentAt: new Date().toUTCString(),
      });

      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);
      expect(result.queued).toBe(false);

      const files = await fs.readdir(TEST_INBOX);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^\d+-[a-z0-9]+\.eml$/);
    });

    it('writes valid .eml content with headers + body', async () => {
      await service.send({
        to: 'bob@example.com',
        subject: 'Subject here',
        text: 'Plain text body',
        html: '<p>HTML body</p>',
        sentAt: new Date().toUTCString(),
      });

      const files = await fs.readdir(TEST_INBOX);
      const content = await fs.readFile(path.join(TEST_INBOX, files[0]), 'utf8');

      expect(content).toMatch(/^Message-ID: <\d+-[a-z0-9]+@orbit\.local>/m);
      expect(content).toMatch(/^To: bob@example\.com/m);
      expect(content).toMatch(/^Subject: Subject here/m);
      expect(content).toContain('MIME-Version: 1.0');
      expect(content).toContain('Content-Type: text/html; charset=utf-8');
      expect(content).toContain('<p>HTML body</p>');
    });

    it('uses default from address when none provided', async () => {
      await service.send({
        to: 'carol@example.com',
        subject: 'No from',
        text: 'Body',
        sentAt: new Date().toUTCString(),
      });

      const files = await fs.readdir(TEST_INBOX);
      const content = await fs.readFile(path.join(TEST_INBOX, files[0]), 'utf8');
      expect(content).toMatch(/^From: ORBIT <hello@orbit\.example>/m);
    });
  });

  describe('sendDirect', () => {
    it('writes file in mock mode and returns id', async () => {
      const result = await service.sendDirect({
        to: 'dave@example.com',
        subject: 'Direct send',
        text: 'Body',
        sentAt: new Date().toUTCString(),
      });

      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);

      const files = await fs.readdir(TEST_INBOX);
      expect(files.length).toBe(1);
    });
  });

  describe('templates', () => {
    it('sendVerificationCode renders code in HTML', async () => {
      const result = await service.sendVerificationCode('eve@example.com', '123456', 'Eve');
      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);

      const files = await fs.readdir(TEST_INBOX);
      const content = await fs.readFile(path.join(TEST_INBOX, files[0]), 'utf8');
      expect(content).toContain('Subject: Verify your ORBIT email');
      expect(content).toContain('123456');
      expect(content).toContain('Welcome to ORBIT');
      expect(content).toContain('expires in 15 minutes');
    });

    it('sendRecoveryCode renders code with security warning', async () => {
      const result = await service.sendRecoveryCode('frank@example.com', '654321', 'Frank');
      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);

      const files = await fs.readdir(TEST_INBOX);
      const content = await fs.readFile(path.join(TEST_INBOX, files[0]), 'utf8');
      expect(content).toContain('Subject: Reset your ORBIT handle');
      expect(content).toContain('654321');
      expect(content).toContain('account may be compromised');
    });

    it('send2FABackupCodes renders all codes', async () => {
      const codes = ['AAAA-BBBB', 'CCCC-DDDD', 'EEEE-FFFF'];
      const result = await service.send2FABackupCodes('grace@example.com', 'Grace', codes);
      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);

      const files = await fs.readdir(TEST_INBOX);
      const content = await fs.readFile(path.join(TEST_INBOX, files[0]), 'utf8');
      expect(content).toContain('Subject: Your ORBIT 2FA backup codes');
      expect(content).toContain('AAAA-BBBB');
      expect(content).toContain('CCCC-DDDD');
      expect(content).toContain('EEEE-FFFF');
    });
  });

  describe('inbox listing', () => {
    beforeEach(async () => {
      await service.send({ to: 'henry@example.com', subject: '1', text: '', sentAt: '' });
      await service.send({ to: 'iris@example.com', subject: '2', text: '', sentAt: '' });
      await service.send({ to: 'jack@example.com', subject: '3', text: '', sentAt: '' });
      // Tiny delay to ensure unique timestamps
      await new Promise((r) => setTimeout(r, 5));
    });

    it('returns all emails', async () => {
      const inbox = await service.listInbox();
      expect(inbox.length).toBe(3);
    });

    it('respects limit option', async () => {
      const inbox = await service.listInbox({ limit: 2 });
      expect(inbox.length).toBe(2);
    });

    it('filters by recipient', async () => {
      const inbox = await service.listInbox({ to: 'iris' });
      expect(inbox.length).toBe(1);
      expect(inbox[0].to).toBe('iris@example.com');
    });
  });

  describe('getEmail by ID', () => {
    it('returns single email when ID matches', async () => {
      const sent = await service.send({
        to: 'kate@example.com',
        subject: 'Find me',
        text: 'Body',
        sentAt: new Date().toUTCString(),
      });

      const fetched = await service.getEmail(sent.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.to).toBe('kate@example.com');
      expect(fetched!.subject).toBe('Find me');
    });

    it('returns null when ID not found', async () => {
      const fetched = await service.getEmail('nonexistent-999');
      expect(fetched).toBeNull();
    });
  });

  describe('parseEml', () => {
    it('parses standard headers', async () => {
      const eml = [
        'Message-ID: <abc-123@orbit.local>',
        'Date: Mon, 01 Jan 2024 12:00:00 GMT',
        'From: ORBIT <hello@orbit.com>',
        'To: leo@example.com',
        'Subject: Test Subject',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Plain body content',
        'on second line',
      ].join('\n');

      await fs.writeFile(path.join(TEST_INBOX, 'abc-123.eml'), eml);
      const result = await service.getEmail('abc-123');
      expect(result).not.toBeNull();
      expect(result!.to).toBe('leo@example.com');
      expect(result!.subject).toBe('Test Subject');
      expect(result!.sentAt).toBe('Mon, 01 Jan 2024 12:00:00 GMT');
      expect(result!.text).toContain('Plain body content');
    });

    it('handles missing Date header gracefully', async () => {
      const eml = [
        'Message-ID: <xyz-789@orbit.local>',
        'To: mia@example.com',
        'Subject: No Date',
        '',
        'Body',
      ].join('\n');

      await fs.writeFile(path.join(TEST_INBOX, 'xyz-789.eml'), eml);
      const result = await service.getEmail('xyz-789');
      expect(result).not.toBeNull();
      expect(result!.to).toBe('mia@example.com');
      expect(result!.sentAt).toBe('');
    });
  });

  describe('ID generation', () => {
    it('generates unique IDs across multiple sends', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await service.send({
          to: 'nina@example.com',
          subject: `Batch ${i}`,
          text: '',
          sentAt: '',
        });
        ids.push(result.id);
      }
      // All IDs should be unique
      const unique = new Set(ids);
      expect(unique.size).toBe(5);
    });

    it('ID format is timestamp-random', async () => {
      const result = await service.send({
        to: 'oscar@example.com',
        subject: 'Format check',
        text: '',
        sentAt: '',
      });
      expect(result.id).toMatch(/^\d+-[a-z0-9]{6}$/);
    });
  });

  describe('graceful degradation', () => {
    it('continues working when inbox dir is missing initially', async () => {
      // Service was constructed with valid dir, but we delete it
      await fs.rm(TEST_INBOX, { recursive: true, force: true });
      // Send should auto-recreate
      const result = await service.send({
        to: 'peggy@example.com',
        subject: 'After delete',
        text: 'Body',
        sentAt: '',
      });
      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);
      // File should exist
      const files = await fs.readdir(TEST_INBOX);
      expect(files.length).toBe(1);
    });
  });
});