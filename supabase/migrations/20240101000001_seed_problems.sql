-- Insert the problem
INSERT INTO public.problems (slug, title, difficulty, category, description, hints, tags, is_published, order_index)
VALUES (
  'the-god-service',
  'The God Service',
  'easy',
  'solid',
  E'## Scenario\n\nYou have inherited a Node.js e-commerce backend from a developer who just quit. The ``UserService`` class is the heart of the codebase. It handles everything related to users.\n\n## Your Task\n\nAnalyze the code files provided. Identify the **primary architectural problem** (name the specific principle being violated), explain **why** it is a problem, and describe **how you would fix it**. Name any design patterns you would introduce.\n\n> You do not need to write complete code. A clear explanation with class names and method signatures is enough.',
  ARRAY[
    'Think about what would happen if the email sending logic needed to change. How many places in the codebase would be affected?',
    'Count how many distinct reasons there are for this class to change. Each reason is a separate responsibility.',
    'The S in SOLID stands for something specific. What is the rule, and how many times is it broken here?'
  ],
  ARRAY['SOLID', 'SRP', 'refactoring', 'separation of concerns'],
  true,
  1
);

-- Problem files (bad code)
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserService.ts', 'typescript',
E'import { Database } from ''./db'';\nimport * as bcrypt from ''bcrypt'';\nimport * as nodemailer from ''nodemailer'';\nimport * as jwt from ''jsonwebtoken'';\nimport * as fs from ''fs'';\nimport * as path from ''path'';\n\nexport class UserService {\n  private db: Database;\n  private mailer: nodemailer.Transporter;\n\n  constructor() {\n    this.db = new Database(process.env.DATABASE_URL!);\n    this.mailer = nodemailer.createTransport({\n      host: ''smtp.gmail.com'',\n      port: 587,\n      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },\n    });\n  }\n\n  // --- Authentication ---\n  async register(email: string, password: string, name: string) {\n    const existing = await this.db.query(''SELECT id FROM users WHERE email = $1'', [email]);\n    if (existing.rows.length > 0) throw new Error(''Email already in use'');\n\n    const hashed = await bcrypt.hash(password, 12);\n    const result = await this.db.query(\n      ''INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id'',\n      [email, hashed, name]\n    );\n    const userId = result.rows[0].id;\n\n    // Send welcome email inline\n    const templatePath = path.join(__dirname, ''templates'', ''welcome.html'');\n    const template     = fs.readFileSync(templatePath, ''utf-8'');\n    const html         = template.replace(''{{name}}'', name);\n    await this.mailer.sendMail({\n      from: ''noreply@shop.com'',\n      to:   email,\n      subject: ''Welcome to our shop!'',\n      html,\n    });\n\n    // Auto-generate and return JWT inline\n    const token = jwt.sign({ userId, email }, process.env.JWT_SECRET!, { expiresIn: ''7d'' });\n    return { userId, token };\n  }\n\n  async login(email: string, password: string) {\n    const result = await this.db.query(''SELECT * FROM users WHERE email = $1'', [email]);\n    if (result.rows.length === 0) throw new Error(''User not found'');\n\n    const user = result.rows[0];\n    const valid = await bcrypt.compare(password, user.password_hash);\n    if (!valid) throw new Error(''Invalid password'');\n\n    const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET!, { expiresIn: ''7d'' });\n\n    // Log the login event directly to a file\n    const logEntry = `${new Date().toISOString()} - User ${user.id} logged in from ${"IP UNKNOWN"}\\n`;\n    fs.appendFileSync(path.join(__dirname, ''logs'', ''auth.log''), logEntry);\n\n    return { userId: user.id, token };\n  }\n\n  // --- Profile ---\n  async getProfile(userId: string) {\n    const result = await this.db.query(''SELECT id, email, name, avatar_url FROM users WHERE id = $1'', [userId]);\n    return result.rows[0] ?? null;\n  }\n\n  async updateAvatar(userId: string, imageBuffer: Buffer, mimeType: string) {\n    // Resize + save image to disk inline (should be cloud storage)\n    const filename   = `avatar_${userId}_${Date.now()}.jpg`;\n    const uploadPath = path.join(__dirname, ''uploads'', filename);\n    fs.writeFileSync(uploadPath, imageBuffer);\n\n    const publicUrl = `/uploads/${filename}`;\n    await this.db.query(''UPDATE users SET avatar_url = $1 WHERE id = $2'', [publicUrl, userId]);\n    return publicUrl;\n  }\n\n  // --- Password Reset ---\n  async requestPasswordReset(email: string) {\n    const result = await this.db.query(''SELECT id FROM users WHERE email = $1'', [email]);\n    if (result.rows.length === 0) return; // Silent fail for security\n\n    const token   = Math.random().toString(36).slice(2) + Date.now();\n    const expires = new Date(Date.now() + 3600 * 1000);\n    await this.db.query(\n      ''INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)'',\n      [result.rows[0].id, token, expires]\n    );\n\n    // Send email inline again\n    await this.mailer.sendMail({\n      from:    ''noreply@shop.com'',\n      to:      email,\n      subject: ''Password reset'',\n      html:    `<a href="https://shop.com/reset?token=${token}">Reset your password</a>`,\n    });\n  }\n\n  // --- Reporting (!!!) ---\n  async generateMonthlyUserReport(): Promise<Buffer> {\n    const result = await this.db.query(\n      `SELECT DATE_TRUNC(''month'', created_at) as month, COUNT(*) as signups\n       FROM users GROUP BY month ORDER BY month DESC LIMIT 12`\n    );\n\n    // Build CSV inline\n    let csv = ''Month,New Signups\\n'';\n    for (const row of result.rows) {\n      csv += `${row.month.toISOString().slice(0,7)},${row.signups}\\n`;\n    }\n    return Buffer.from(csv);\n  }\n}\n',
0, false
FROM public.problems WHERE slug = 'the-god-service';

-- Solution files
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserService.ts', 'typescript',
E'// SOLUTION: UserService is now a thin coordinator.\n// It only orchestrates — it does not implement auth, email, or reporting.\nimport { AuthService }    from ''./AuthService'';\nimport { EmailService }   from ''./EmailService'';\nimport { FileService }    from ''./FileService'';\nimport { ReportService }  from ''./ReportService'';\nimport { UserRepository } from ''./UserRepository'';\n\nexport class UserService {\n  constructor(\n    private readonly users:    UserRepository,\n    private readonly auth:     AuthService,\n    private readonly email:    EmailService,\n    private readonly files:    FileService,\n    private readonly reports:  ReportService\n  ) {}\n\n  async register(email: string, password: string, name: string) {\n    if (await this.users.findByEmail(email)) throw new Error(''Email already in use'');\n    const hashed = await this.auth.hashPassword(password);\n    const user   = await this.users.create({ email, passwordHash: hashed, name });\n    const token  = this.auth.generateToken(user.id, email);\n    await this.email.sendWelcome(email, name);\n    return { userId: user.id, token };\n  }\n\n  async login(email: string, password: string) {\n    const user  = await this.users.findByEmail(email);\n    if (!user) throw new Error(''User not found'');\n    await this.auth.verifyPassword(password, user.passwordHash);\n    const token = this.auth.generateToken(user.id, email);\n    return { userId: user.id, token };\n  }\n\n  async updateAvatar(userId: string, buffer: Buffer, mimeType: string) {\n    const url = await this.files.uploadAvatar(userId, buffer, mimeType);\n    await this.users.updateAvatarUrl(userId, url);\n    return url;\n  }\n\n  async generateMonthlyReport(): Promise<Buffer> {\n    return this.reports.generateUserSignupReport();\n  }\n}\n',
0, true
FROM public.problems WHERE slug = 'the-god-service';

-- Rubric
INSERT INTO public.solution_rubrics (problem_id, rubric_text, example_correct_answer, passing_score)
SELECT id,
'GRADING CRITERIA for "The God Service":

PRIMARY VIOLATION (50 points):
The student must correctly identify that UserService violates the Single Responsibility Principle (SRP).
A class should have only one reason to change. UserService has AT LEAST 5:
1. Authentication logic changes (password hashing, JWT)
2. Email template or provider changes
3. File storage strategy changes (disk → S3)
4. Reporting format changes
5. Database schema changes

SECONDARY OBSERVATIONS (20 points, at least one needed):
- The email sending code is duplicated between register() and requestPasswordReset()
- File writes happen inline (tight coupling to the filesystem)
- The JWT secret and email credentials are hard-coded into this class
- The password reset token generator uses Math.random() (not cryptographically secure)

PROPOSED FIX (30 points):
Student must propose splitting into separate services. Correct answers include:
- AuthService (handles hashing, JWT generation, token verification)
- EmailService (handles all email sending)
- FileService or StorageService (handles file uploads)
- ReportService (handles analytics/CSV generation)
- UserRepository (handles raw database queries)
The student does NOT need to name all five. Identifying 2-3 and explaining the principle scores 70+.

DO NOT PASS if:
- Student says "use a design pattern" without identifying SRP
- Student only mentions "the class is too long" without naming SRP
- Student identifies the wrong principle (e.g., says it violates DIP or OCP primarily)',
'The UserService violates the Single Responsibility Principle. It has at least 5 reasons to change: if we switch email providers, if we change JWT secrets or expiry, if we move files to S3, if we change the CSV report format, or if the database schema changes. The fix is to extract: an AuthService for password hashing and JWT logic, an EmailService for all email sending, a FileService for uploads, and a ReportService for analytics. The UserService becomes a thin coordinator that calls these services. This also eliminates the duplicated mailer.sendMail() calls between register() and requestPasswordReset().',
70
FROM public.problems WHERE slug = 'the-god-service';


INSERT INTO public.problems (slug, title, difficulty, category, description, hints, tags, is_published, order_index)
VALUES (
  'the-notification-nightmare',
  'The Notification Nightmare',
  'medium',
  'gof_behavioral',
  E'## Scenario\n\nYour team''s ``NotificationService`` started with just email notifications. Since then, SMS and Slack were bolted on. A new requirement just arrived: the product team wants push notifications added **by next Friday**.\n\nA senior engineer reviewed the code and said: *"If we add push notifications the same way we added SMS, I''m quitting."*\n\n## Your Task\n\n1. Identify the **specific SOLID principle** being violated and explain why.\n2. Name the **GoF design pattern** that would solve this problem.\n3. Describe the **refactored structure** in enough detail that a developer could implement it without your help. Include interface names, method signatures, and how the service would use them.',
  ARRAY[
    'Every time a new channel is added, what happens to the existing class? Is that acceptable?',
    'What would happen to this class in 6 months if you added push, WhatsApp, Telegram, and in-app notifications?',
    'There is a famous GoF behavioral pattern specifically designed for this problem. It defines a family of algorithms (here: notification channels) and makes them interchangeable.'
  ],
  ARRAY['SOLID', 'OCP', 'Strategy Pattern', 'GoF', 'Behavioral'],
  true,
  2
);

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'NotificationService.ts', 'typescript',
E'export type NotificationChannel = ''email'' | ''sms'' | ''slack'';\n\nexport interface NotificationPayload {\n  recipientId: string;\n  subject:     string;\n  message:     string;\n  metadata?:   Record<string, string>;\n}\n\nexport class NotificationService {\n  async send(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {\n    if (channel === ''email'') {\n      await this.sendEmail(payload);\n    } else if (channel === ''sms'') {\n      await this.sendSms(payload);\n    } else if (channel === ''slack'') {\n      await this.sendSlack(payload);\n    } else {\n      throw new Error(`Unsupported channel: ${channel}`);\n    }\n  }\n\n  async sendBulk(channel: NotificationChannel, payloads: NotificationPayload[]): Promise<void> {\n    for (const payload of payloads) {\n      if (channel === ''email'') {\n        await this.sendEmail(payload);\n      } else if (channel === ''sms'') {\n        await this.sendSms(payload);\n      } else if (channel === ''slack'') {\n        await this.sendSlack(payload);\n      }\n    }\n  }\n\n  async getUserPreferredChannel(userId: string): Promise<NotificationChannel> {\n    // Imagine this queries a DB\n    return ''email'';\n  }\n\n  async notifyByPreference(userId: string, payload: NotificationPayload): Promise<void> {\n    const channel = await this.getUserPreferredChannel(userId);\n    if (channel === ''email'') {\n      await this.sendEmail(payload);\n    } else if (channel === ''sms'') {\n      await this.sendSms(payload);\n    } else if (channel === ''slack'') {\n      await this.sendSlack(payload);\n    }\n  }\n\n  private async sendEmail(payload: NotificationPayload): Promise<void> {\n    console.log(`[EMAIL] To: ${payload.recipientId} | ${payload.subject}`);\n    // ... nodemailer logic ...\n  }\n\n  private async sendSms(payload: NotificationPayload): Promise<void> {\n    console.log(`[SMS] To: ${payload.recipientId} | ${payload.message.slice(0, 160)}`);\n    // ... Twilio logic ...\n  }\n\n  private async sendSlack(payload: NotificationPayload): Promise<void> {\n    const webhookUrl = payload.metadata?.[''slackWebhook''] ?? '''';\n    console.log(`[SLACK] Webhook: ${webhookUrl} | ${payload.message}`);\n    // ... Slack WebClient logic ...\n  }\n}\n',
0, false
FROM public.problems WHERE slug = 'the-notification-nightmare';

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserPreferenceService.ts', 'typescript',
E'// This service is tightly coupled to the hardcoded channel list\nexport class UserPreferenceService {\n  async getChannelForUser(userId: string): Promise<''email'' | ''sms'' | ''slack''> {\n    // In a real app, query the DB:\n    // SELECT preferred_channel FROM user_settings WHERE user_id = $1\n    const mockPreferences: Record<string, ''email'' | ''sms'' | ''slack''> = {\n      ''user_001'': ''email'',\n      ''user_002'': ''sms'',\n      ''user_003'': ''slack'',\n    };\n    return mockPreferences[userId] ?? ''email'';\n  }\n\n  // When push is added, this signature MUST change too:\n  async setChannelForUser(userId: string, channel: ''email'' | ''sms'' | ''slack''): Promise<void> {\n    console.log(`Setting ${userId} preferred channel to ${channel}`);\n  }\n}\n',
1, false
FROM public.problems WHERE slug = 'the-notification-nightmare';

-- Solution files
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'INotificationChannel.ts', 'typescript',
E'// SOLUTION FILE 1: The Strategy interface\n// Adding a new channel means implementing this interface — nothing else changes.\nexport interface INotificationChannel {\n  readonly channelName: string;\n  send(payload: NotificationPayload): Promise<void>;\n}\n\nexport interface NotificationPayload {\n  recipientId: string;\n  subject:     string;\n  message:     string;\n  metadata?:   Record<string, string>;\n}\n',
0, true
FROM public.problems WHERE slug = 'the-notification-nightmare';

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'NotificationService.ts', 'typescript',
E'// SOLUTION FILE 2: The Context — open for extension, closed for modification\nimport type { INotificationChannel, NotificationPayload } from ''./INotificationChannel'';\n\nexport class NotificationService {\n  private channels = new Map<string, INotificationChannel>();\n\n  // Register any channel at runtime — no switch/if chains needed\n  registerChannel(channel: INotificationChannel): void {\n    this.channels.set(channel.channelName, channel);\n  }\n\n  async send(channelName: string, payload: NotificationPayload): Promise<void> {\n    const channel = this.channels.get(channelName);\n    if (!channel) throw new Error(`Channel not registered: ${channelName}`);\n    await channel.send(payload);\n  }\n\n  async sendBulk(channelName: string, payloads: NotificationPayload[]): Promise<void> {\n    await Promise.all(payloads.map(p => this.send(channelName, p)));\n  }\n}\n\n// Usage (in app bootstrap / DI container):\n// const service = new NotificationService();\n// service.registerChannel(new EmailChannel());\n// service.registerChannel(new SmsChannel());\n// service.registerChannel(new SlackChannel());\n// service.registerChannel(new PushChannel()); // Zero changes to NotificationService!\n',
1, true
FROM public.problems WHERE slug = 'the-notification-nightmare';

-- Rubric
INSERT INTO public.solution_rubrics (problem_id, rubric_text, example_correct_answer, passing_score)
SELECT id,
'GRADING CRITERIA for "The Notification Nightmare":

VIOLATION IDENTIFICATION (35 points):
The student must identify the Open/Closed Principle (OCP) violation.
The class is NOT closed for modification: every new channel requires editing send(), sendBulk(), and notifyByPreference() — adding push notifications would require touching the class in 3 places.
Bonus (5 points): Student also notes that the string union type ''email'' | ''sms'' | ''slack'' in UserPreferenceService must also be updated.

PATTERN IDENTIFICATION (25 points):
Student must name the Strategy Pattern.
Accept also: Strategy + Registry Pattern (bonus 5 points if they mention the registry).
Do NOT accept: "Factory Pattern", "Template Method", or "Observer" as the PRIMARY answer.

REFACTORED STRUCTURE (40 points):
A passing answer describes:
1. An interface (INotificationChannel or INotifier) with a send(payload) method (15 pts)
2. Concrete implementations per channel (EmailChannel, SmsChannel, etc.) (10 pts)
3. NotificationService accepts channels via constructor injection or a register/map approach,
   replacing all if/else chains with a single channel.send(payload) call (15 pts)

DO NOT PASS if:
- Student names OCP but does not propose an interface or Strategy pattern
- Student only says "put each channel in its own class" without explaining how NotificationService uses them
- Student proposes a Factory Pattern without explaining how it removes the if/else chain
- Student score should be 40-69 if they identify OCP + Strategy but fail to describe the interface or registry mechanism',
'The code violates the Open/Closed Principle. Every time a new notification channel is added (like push notifications), the developer must modify three methods: send(), sendBulk(), and notifyByPreference(). The fix is the Strategy Pattern. First, extract an INotificationChannel interface with a single send(payload: NotificationPayload): Promise<void> method and a channelName string property. Then create concrete classes: EmailChannel, SmsChannel, SlackChannel, PushChannel — each implementing the interface. Finally, refactor NotificationService to hold a Map<string, INotificationChannel> and expose a registerChannel(channel) method. The send() method becomes: const channel = this.channels.get(channelName); await channel.send(payload). Adding push notifications now means creating a PushChannel class and calling service.registerChannel(new PushChannel()) at startup — NotificationService itself is never touched again.',
70
FROM public.problems WHERE slug = 'the-notification-nightmare';
