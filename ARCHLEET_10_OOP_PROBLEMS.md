# ARCHLEET — 10 OOP PROBLEMS (SEED DATA)
### Sourced directly from: Martin Fowler, *Refactoring: Improving the Design of Existing Code*, 2nd Edition
### Each problem maps to a named Code Smell from Chapter 3 and a named Refactoring from the catalog.

---

> **HOW TO USE THIS FILE**
> Each problem contains four sections:
> 1. **PROBLEM FILES** — the spaghetti code shown to the user (3–5 TypeScript files)
> 2. **SOLUTION FILES** — the clean refactored code (unlocked after solving/giving up)
> 3. **RUBRIC** — the hidden grading criteria sent to the AI evaluator
> 4. **SQL** — ready-to-run INSERT statements for your Supabase database
>
> The Fowler reference for each problem is cited so you can read the original
> motivation directly in the book before publishing the problem.

---

## PROBLEM 01 — "The Billing Monolith"

| Field | Value |
|---|---|
| Slug | `the-billing-monolith` |
| Difficulty | Medium |
| Category | `solid` (SRP + Long Function smell) |
| Fowler Reference | Chapter 1 pp. 27–45: *Decomposing the statement Function* |
| Primary Smell | Long Function (Ch. 3) |
| Primary Refactoring | Extract Function (p. 106), Split Phase (p. 154) |
| Tags | `long-function`, `split-phase`, `extract-function`, `SRP` |

### SCENARIO DESCRIPTION (shown to user, Markdown)

```markdown
## The Billing Statement Generator

You've just joined a SaaS company as a backend engineer. The previous developer
left behind a single function that generates customer invoices. It was written
quickly to "just get it working" and nobody has touched it since.

The product team now wants two changes:
1. An **HTML version** of the statement for email delivery.
2. Support for a **new subscription type** called `enterprise` with custom pricing.

A senior engineer looked at the code and said:
> *"If you try to add HTML output to this function as-is, I guarantee you'll
> introduce a bug in the calculation logic. The function is doing too many
> things at once."*

## Your Task

1. Identify **every distinct responsibility** currently mixed inside `generateStatement()`.
2. Name the **specific code smell** (use Martin Fowler's terminology) that describes this problem.
3. Describe how you would **refactor the function** — name the specific refactoring
   technique(s) and describe the resulting structure. You do not need to write
   complete code, but be specific about what each extracted piece would be named
   and what it would do.
```

### PROBLEM FILES

**File 1: `statementGenerator.ts`**
```typescript
import { Invoice, Play, Performance } from './types';

export function generateStatement(invoice: Invoice, plays: Record<string, Play>): string {
  let totalAmount = 0;
  let volumeCredits = 0;
  let result = `Statement for ${invoice.customer}\n`;

  const formatCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format;

  for (const perf of invoice.performances) {
    const play = plays[perf.playID];
    let thisAmount = 0;

    // Calculate amount per performance
    switch (play.type) {
      case 'tragedy':
        thisAmount = 40000;
        if (perf.audience > 30) {
          thisAmount += 1000 * (perf.audience - 30);
        }
        break;
      case 'comedy':
        thisAmount = 30000;
        if (perf.audience > 20) {
          thisAmount += 10000 + 500 * (perf.audience - 20);
        }
        thisAmount += 300 * perf.audience;
        break;
      case 'musical':
        thisAmount = 25000;
        if (perf.audience > 15) {
          thisAmount += 5000 + 300 * (perf.audience - 15);
        }
        thisAmount += 200 * perf.audience;
        break;
      default:
        throw new Error(`unknown type: ${play.type}`);
    }

    // Add volume credits
    volumeCredits += Math.max(perf.audience - 30, 0);
    if ('comedy' === play.type) volumeCredits += Math.floor(perf.audience / 5);
    if ('musical' === play.type) volumeCredits += Math.floor(perf.audience / 10);

    // Print line for this order
    result += `  ${play.name}: ${formatCurrency(thisAmount / 100)} (${perf.audience} seats)\n`;
    totalAmount += thisAmount;
  }

  result += `Amount owed is ${formatCurrency(totalAmount / 100)}\n`;
  result += `You earned ${volumeCredits} credits\n`;
  return result;
}
```

**File 2: `types.ts`**
```typescript
export interface Play {
  name: string;
  type: 'tragedy' | 'comedy' | 'musical';
}

export interface Performance {
  playID: string;
  audience: number;
}

export interface Invoice {
  customer: string;
  performances: Performance[];
}
```

**File 3: `invoiceController.ts`**
```typescript
import { generateStatement } from './statementGenerator';
import { Invoice } from './types';

// When the product team asks for HTML output, what happens to generateStatement?
// When they add 'enterprise' play type, how many places in generateStatement change?

export async function handleGetStatement(
  customerId: string,
  invoiceData: Invoice,
  playsData: Record<string, any>
): Promise<{ text: string; html?: string }> {
  // Currently only text is supported.
  // HTML would require duplicating generateStatement with HTML tags — a dangerous copy.
  const text = generateStatement(invoiceData, playsData);
  return { text };
}
```

### SOLUTION FILES

**File 1: `statementGenerator.ts` (solution)**
```typescript
// SOLUTION: Split into two phases — data preparation and formatting.
// Each phase is independently testable and extendable.
import { Invoice, Play, Performance, StatementData, PerformanceData } from './types';

// ---- Phase 1: Pure data calculation (no formatting concerns) ----

function amountFor(perf: Performance, play: Play): number {
  switch (play.type) {
    case 'tragedy':
      let amount = 40000;
      if (perf.audience > 30) amount += 1000 * (perf.audience - 30);
      return amount;
    case 'comedy':
      let comedyAmount = 30000 + 300 * perf.audience;
      if (perf.audience > 20) comedyAmount += 10000 + 500 * (perf.audience - 20);
      return comedyAmount;
    case 'musical':
      let musicalAmount = 25000 + 200 * perf.audience;
      if (perf.audience > 15) musicalAmount += 5000 + 300 * (perf.audience - 15);
      return musicalAmount;
    default:
      throw new Error(`unknown type: ${(play as any).type}`);
  }
}

function volumeCreditsFor(perf: Performance, play: Play): number {
  let credits = Math.max(perf.audience - 30, 0);
  if (play.type === 'comedy') credits += Math.floor(perf.audience / 5);
  if (play.type === 'musical') credits += Math.floor(perf.audience / 10);
  return credits;
}

function createStatementData(invoice: Invoice, plays: Record<string, Play>): StatementData {
  const performances: PerformanceData[] = invoice.performances.map(perf => {
    const play = plays[perf.playID];
    return {
      ...perf,
      play,
      amount: amountFor(perf, play),
      volumeCredits: volumeCreditsFor(perf, play),
    };
  });

  return {
    customer: invoice.customer,
    performances,
    totalAmount: performances.reduce((sum, p) => sum + p.amount, 0),
    totalVolumeCredits: performances.reduce((sum, p) => sum + p.volumeCredits, 0),
  };
}

// ---- Phase 2a: Text formatting (one renderer) ----

function renderPlainText(data: StatementData): string {
  const format = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format;

  let result = `Statement for ${data.customer}\n`;
  for (const perf of data.performances) {
    result += `  ${perf.play.name}: ${format(perf.amount / 100)} (${perf.audience} seats)\n`;
  }
  result += `Amount owed is ${format(data.totalAmount / 100)}\n`;
  result += `You earned ${data.totalVolumeCredits} credits\n`;
  return result;
}

// ---- Phase 2b: HTML formatting (second renderer — zero duplication of calc logic) ----

function renderHtml(data: StatementData): string {
  const format = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format;

  let result = `<h1>Statement for ${data.customer}</h1>\n<table>\n`;
  result += `<tr><th>Play</th><th>Seats</th><th>Cost</th></tr>\n`;
  for (const perf of data.performances) {
    result += `<tr><td>${perf.play.name}</td><td>${perf.audience}</td><td>${format(perf.amount / 100)}</td></tr>\n`;
  }
  result += `</table>\n`;
  result += `<p>Amount owed is <em>${format(data.totalAmount / 100)}</em></p>\n`;
  result += `<p>You earned <em>${data.totalVolumeCredits}</em> credits</p>\n`;
  return result;
}

// ---- Public API ----
export function generateStatement(invoice: Invoice, plays: Record<string, Play>): string {
  return renderPlainText(createStatementData(invoice, plays));
}

export function generateHtmlStatement(invoice: Invoice, plays: Record<string, Play>): string {
  return renderHtml(createStatementData(invoice, plays));
}
// Adding 'enterprise' type now means: add one case to amountFor() and one case
// to volumeCreditsFor(). Zero changes to rendering. Zero risk of formatting bugs.
```

**File 2: `types.ts` (solution)**
```typescript
export interface Play {
  name: string;
  type: 'tragedy' | 'comedy' | 'musical';
}

export interface Performance {
  playID: string;
  audience: number;
}

export interface PerformanceData extends Performance {
  play: Play;
  amount: number;
  volumeCredits: number;
}

export interface StatementData {
  customer: string;
  performances: PerformanceData[];
  totalAmount: number;
  totalVolumeCredits: number;
}

export interface Invoice {
  customer: string;
  performances: Performance[];
}
```

### RUBRIC (HIDDEN — for AI evaluator only)

```
GRADING CRITERIA for "The Billing Monolith":

PRIMARY SMELL IDENTIFICATION (30 points):
Student must identify that generateStatement() has too many responsibilities
mixed into a single function. Acceptable answers:
- "Long Function" (Fowler's exact term) — full credit
- "violates SRP" / "does too many things" — full credit if they enumerate the
  distinct concerns
- "no separation of concerns" — partial credit (20 pts) if they don't enumerate concerns

The DISTINCT RESPONSIBILITIES they should identify (at least 2 of 4 for passing):
1. Calculating the amount per performance (pricing logic)
2. Calculating volume credits
3. Formatting currency / building the output string
4. Iterating over performances and accumulating totals

REFACTORING TECHNIQUE (40 points):
Must name at least ONE of:
- Extract Function (p. 106) — extract amountFor(), volumeCreditsFor() — 20 pts
- Split Phase (p. 154) — separate calculation phase from rendering phase — 20 pts
Both together for full 40 pts.

The key insight to award full points: student explains that separating the
calculation phase from the rendering phase means HTML output can be added
WITHOUT touching pricing logic. If they say "extract the HTML into its own
function" without separating the data from the rendering, award 25/40.

FUTURE EXTENSIBILITY REASONING (30 points):
Award points if student explains WHY the split helps:
- Adding a new play type only requires changing amountFor() (15 pts)
- Adding HTML output only requires a new renderer (15 pts)
If they only say "it becomes easier to read" without specifics, award 10/30.

DO NOT PASS if:
- Student only says "the function is too long, split it up" with no specifics
- Student says "use a class" without explaining the phase separation
- Score below 70: vague answers like "extract some helper functions" with no
  explanation of what each helper does or why
```

### HINTS

```
1. Count how many distinct things this function is doing. Write each one down.
   A function should have ONE reason to change — how many does this one have?

2. Martin Fowler calls this smell "Long Function." But the length is a symptom,
   not the cause. What are the distinct *phases* of computation happening here?
   What if you needed to produce HTML output? Where would that change live?

3. Fowler uses "Split Phase" for this exact situation: when code is mixing two
   or more phases of work. The key split here is between computing the data
   and rendering the output. Try separating these two phases with a data
   structure in between.
```

### SQL

```sql
INSERT INTO public.problems (slug, title, difficulty, category, description, hints, tags, is_published, order_index)
VALUES (
  'the-billing-monolith',
  'The Billing Monolith',
  'medium', 'solid',
  E'## The Billing Statement Generator\n\nYou''ve just joined a SaaS company as a backend engineer. The previous developer left behind a single function that generates customer invoices.\n\nThe product team now wants two changes:\n1. An **HTML version** of the statement for email delivery.\n2. Support for a **new subscription type** called `enterprise` with custom pricing.\n\nA senior engineer said:\n> *"If you try to add HTML output to this function as-is, I guarantee you''ll introduce a bug in the calculation logic."*\n\n## Your Task\n\n1. Identify **every distinct responsibility** currently mixed inside `generateStatement()`.\n2. Name the **specific code smell** (use Martin Fowler''s terminology).\n3. Describe how you would **refactor** it — name the specific technique(s) and the resulting structure.',
  ARRAY[
    'Count how many distinct things this function is doing. A function should have ONE reason to change — how many does this one have?',
    'Fowler calls this smell "Long Function." What are the distinct *phases* of computation? What if you needed to produce HTML output?',
    'Look up "Split Phase" in Fowler. The key split is between computing the data and rendering the output. Try separating these with a data structure in between.'
  ],
  ARRAY['long-function', 'split-phase', 'extract-function', 'SRP'],
  true, 1
);
```

---

## PROBLEM 02 — "The Envious Calculator"

| Field | Value |
|---|---|
| Slug | `the-envious-calculator` |
| Difficulty | Easy |
| Category | `solid` |
| Fowler Reference | Chapter 3, p. 84: *Feature Envy* |
| Primary Smell | Feature Envy |
| Primary Refactoring | Move Function (p. 198) |
| Tags | `feature-envy`, `move-function`, `cohesion` |

### SCENARIO DESCRIPTION

```markdown
## The Shipping Cost Calculator

A logistics platform has a `ShippingService` that calculates shipping costs.
You've been asked to add a new carrier (DHL) and noticed that the existing
`calculateShippingCost()` method feels oddly placed.

A teammate pointed out:
> *"This method calls 6 different getters on the Order object. It seems more
> interested in Order's data than in anything ShippingService owns."*

## Your Task

1. Identify the **code smell** by name (use Fowler's terminology from Chapter 3).
2. Explain **why** it is a problem in terms of coupling and cohesion.
3. Describe the **refactoring** you would apply and what the code looks like after.
   Be specific: where does the function end up, and what signature does it have?
```

### PROBLEM FILES

**File 1: `Order.ts`**
```typescript
export class Order {
  private id: string;
  private customerId: string;
  private weightKg: number;
  private lengthCm: number;
  private widthCm: number;
  private heightCm: number;
  private originPostalCode: string;
  private destinationPostalCode: string;
  private isFragile: boolean;
  private requiresRefrigeration: boolean;

  constructor(data: {
    id: string; customerId: string; weightKg: number;
    lengthCm: number; widthCm: number; heightCm: number;
    originPostalCode: string; destinationPostalCode: string;
    isFragile: boolean; requiresRefrigeration: boolean;
  }) {
    Object.assign(this, data);
  }

  getId(): string { return this.id; }
  getCustomerId(): string { return this.customerId; }
  getWeightKg(): number { return this.weightKg; }
  getLengthCm(): number { return this.lengthCm; }
  getWidthCm(): number { return this.widthCm; }
  getHeightCm(): number { return this.heightCm; }
  getOriginPostalCode(): string { return this.originPostalCode; }
  getDestinationPostalCode(): string { return this.destinationPostalCode; }
  isOrderFragile(): boolean { return this.isFragile; }
  requiresOrderRefrigeration(): boolean { return this.requiresRefrigeration; }
}
```

**File 2: `ShippingService.ts`**
```typescript
import { Order } from './Order';

export class ShippingService {
  private readonly BASE_RATE_PER_KG = 2.5;
  private readonly VOLUMETRIC_DIVISOR = 5000;
  private readonly FRAGILE_SURCHARGE = 1.3;
  private readonly REFRIGERATION_SURCHARGE = 1.5;

  // This method "envies" the Order class — it uses 6 of Order's getters
  // and contains logic that is fundamentally about an Order's properties.
  calculateShippingCost(order: Order): number {
    const weightKg       = order.getWeightKg();
    const lengthCm       = order.getLengthCm();
    const widthCm        = order.getWidthCm();
    const heightCm       = order.getHeightCm();
    const isFragile      = order.isOrderFragile();
    const needsCooling   = order.requiresOrderRefrigeration();

    // Volumetric weight calculation (common carrier standard)
    const volumetricWeight = (lengthCm * widthCm * heightCm) / this.VOLUMETRIC_DIVISOR;
    const chargeableWeight = Math.max(weightKg, volumetricWeight);

    let cost = chargeableWeight * this.BASE_RATE_PER_KG;

    if (isFragile)    cost *= this.FRAGILE_SURCHARGE;
    if (needsCooling) cost *= this.REFRIGERATION_SURCHARGE;

    return Math.round(cost * 100) / 100;
  }

  schedulePickup(order: Order, date: Date): { confirmationId: string } {
    // ShippingService legitimately owns this method
    return { confirmationId: `PICKUP-${order.getId()}-${date.getTime()}` };
  }

  trackShipment(trackingNumber: string): { status: string; location: string } {
    // ShippingService legitimately owns this method too
    return { status: 'IN_TRANSIT', location: 'Cairo Distribution Center' };
  }
}
```

**File 3: `OrderController.ts`**
```typescript
import { Order } from './Order';
import { ShippingService } from './ShippingService';

export class OrderController {
  private shippingService = new ShippingService();

  async getShippingQuote(orderData: any): Promise<{ cost: number }> {
    const order = new Order(orderData);
    const cost  = this.shippingService.calculateShippingCost(order);
    return { cost };
  }
}
```

### SOLUTION FILES

**File 1: `Order.ts` (solution)**
```typescript
// SOLUTION: Move Function — calculateShippingCost moves INTO Order.
// The function belongs with the data it uses.
export class Order {
  private id: string;
  private customerId: string;
  private weightKg: number;
  private lengthCm: number;
  private widthCm: number;
  private heightCm: number;
  private originPostalCode: string;
  private destinationPostalCode: string;
  private isFragile: boolean;
  private requiresRefrigeration: boolean;

  private static readonly BASE_RATE_PER_KG     = 2.5;
  private static readonly VOLUMETRIC_DIVISOR   = 5000;
  private static readonly FRAGILE_SURCHARGE    = 1.3;
  private static readonly REFRIGERATION_SURCHARGE = 1.5;

  constructor(data: {
    id: string; customerId: string; weightKg: number;
    lengthCm: number; widthCm: number; heightCm: number;
    originPostalCode: string; destinationPostalCode: string;
    isFragile: boolean; requiresRefrigeration: boolean;
  }) {
    Object.assign(this, data);
  }

  getId(): string { return this.id; }
  getCustomerId(): string { return this.customerId; }
  getOriginPostalCode(): string { return this.originPostalCode; }
  getDestinationPostalCode(): string { return this.destinationPostalCode; }

  // The calculation now lives with its data. No getters needed.
  calculateShippingCost(): number {
    const volumetricWeight = (this.lengthCm * this.widthCm * this.heightCm)
      / Order.VOLUMETRIC_DIVISOR;
    const chargeableWeight = Math.max(this.weightKg, volumetricWeight);

    let cost = chargeableWeight * Order.BASE_RATE_PER_KG;
    if (this.isFragile)              cost *= Order.FRAGILE_SURCHARGE;
    if (this.requiresRefrigeration)  cost *= Order.REFRIGERATION_SURCHARGE;

    return Math.round(cost * 100) / 100;
  }
}
```

**File 2: `ShippingService.ts` (solution)**
```typescript
import { Order } from './Order';

// ShippingService now only contains things that are genuinely its own concern:
// external carrier scheduling and tracking. It no longer calculates cost.
export class ShippingService {
  schedulePickup(order: Order, date: Date): { confirmationId: string } {
    return { confirmationId: `PICKUP-${order.getId()}-${date.getTime()}` };
  }

  trackShipment(trackingNumber: string): { status: string; location: string } {
    return { status: 'IN_TRANSIT', location: 'Cairo Distribution Center' };
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Envious Calculator":

PRIMARY SMELL (40 points):
Student must name "Feature Envy" (Fowler's exact term from Ch. 3).
Accept also: "the function wants to be in a different class", "wrong placement".
Do NOT accept "tight coupling" or "violates SRP" as the primary answer — those
are symptoms, not the named smell. Award 20 pts for correct symptom description
without naming Feature Envy.

EXPLANATION OF THE PROBLEM (25 points):
A passing answer explains: calculateShippingCost() uses 6 getters from Order
and contains zero reference to any of ShippingService's own state. The heuristic
from Fowler: "put things together that change together" — if Order's fields
change, this method changes. It belongs with Order's data.

PROPOSED FIX (35 points):
Must name "Move Function" (Fowler p. 198).
Describe that calculateShippingCost() moves from ShippingService to Order.
The new signature is Order.calculateShippingCost() with no parameters
(it uses `this` instead of getters).

Award partial credit (20/35) if they say "move it to the Order class" without
naming Move Function.
Award full credit (35/35) if they also note that the public getters for
weightKg, dimensions, isFragile, and requiresRefrigeration can be
removed or made private after the move — because nothing outside the class
needed them.

DO NOT PASS if student suggests adding more methods to ShippingService or
making ShippingService depend on Order in a different way without moving
the function.
```

### HINTS

```
1. Count how many times calculateShippingCost() calls a getter on the Order
   object. Now count how many times it uses anything from ShippingService itself.
   What does that ratio tell you?

2. Fowler says a function with Feature Envy "spends more time communicating
   with functions or data inside another module than it does within its own."
   Which module does calculateShippingCost belong in, really?

3. The cure is "Move Function" (Fowler p. 198). If you move calculateShippingCost
   inside Order, what happens to all those getters it was calling?
```

---

## PROBLEM 03 — "The Primitive Address"

| Field | Value |
|---|---|
| Slug | `the-primitive-address` |
| Difficulty | Easy |
| Category | `solid` |
| Fowler Reference | Chapter 3, p. 88: *Primitive Obsession*; Chapter 6: *Introduce Parameter Object* (p. 140) |
| Primary Smell | Primitive Obsession + Data Clumps |
| Primary Refactoring | Replace Primitive with Object (p. 174), Introduce Parameter Object (p. 140) |
| Tags | `primitive-obsession`, `data-clumps`, `value-object`, `parameter-object` |

### SCENARIO DESCRIPTION

```markdown
## The Scattered Address

You're reviewing a shipping system that handles customer addresses. You notice
that the same four parameters — `street`, `city`, `postalCode`, `country` —
appear together in every function signature across three different service files.

The same address formatting logic has been copy-pasted into two different places.
When Egypt's postal code format changed from 5 digits to 6, the team had to find
and fix 7 different locations in the codebase.

## Your Task

1. Name the **two code smells** (Fowler's terminology) you can identify in these files.
2. Explain why treating address data as loose primitives is a problem.
3. Describe the **refactoring** that fixes both smells simultaneously — what new
   abstraction do you introduce, what does it look like, and which Fowler
   refactoring technique(s) does it correspond to?
```

### PROBLEM FILES

**File 1: `CustomerService.ts`**
```typescript
export class CustomerService {
  async createCustomer(
    name: string,
    email: string,
    street: string,
    city: string,
    postalCode: string,
    country: string
  ): Promise<{ customerId: string }> {
    // Validate postal code inline (duplicated in ShippingService)
    if (country === 'EG' && !/^\d{5,6}$/.test(postalCode)) {
      throw new Error('Invalid Egyptian postal code');
    }
    if (country === 'US' && !/^\d{5}(-\d{4})?$/.test(postalCode)) {
      throw new Error('Invalid US ZIP code');
    }

    // Format address for display (duplicated in InvoiceService)
    const formattedAddress = `${street}, ${city} ${postalCode}, ${country}`;

    const customerId = `CUST-${Date.now()}`;
    console.log(`Created customer ${name} at ${formattedAddress}`);
    return { customerId };
  }

  async updateAddress(
    customerId: string,
    street: string,
    city: string,
    postalCode: string,
    country: string
  ): Promise<void> {
    if (country === 'EG' && !/^\d{5,6}$/.test(postalCode)) {
      throw new Error('Invalid Egyptian postal code');
    }
    console.log(`Updated address for ${customerId}: ${street}, ${city}`);
  }
}
```

**File 2: `ShippingService.ts`**
```typescript
export class ShippingService {
  calculateRate(
    weightKg: number,
    originStreet: string,
    originCity: string,
    originPostalCode: string,
    originCountry: string,
    destStreet: string,
    destCity: string,
    destPostalCode: string,
    destCountry: string
  ): number {
    // 8 of the 9 parameters are address data — this is a Data Clump
    const isDomestic = originCountry === destCountry;
    const baseRate   = isDomestic ? 15 : 45;
    return baseRate * weightKg;
  }

  formatShippingLabel(
    recipientName: string,
    street: string,
    city: string,
    postalCode: string,
    country: string
  ): string {
    // Formatting logic duplicated from CustomerService
    return `${recipientName}\n${street}\n${city} ${postalCode}\n${country}`;
  }
}
```

**File 3: `InvoiceService.ts`**
```typescript
export class InvoiceService {
  generateInvoice(
    orderId: string,
    customerName: string,
    billingStreet: string,
    billingCity: string,
    billingPostalCode: string,
    billingCountry: string
  ): string {
    // Yet another format — slightly different from CustomerService's format
    const addressBlock = `${billingStreet}\n${billingCity}, ${billingPostalCode}\n${billingCountry}`;

    return `INVOICE #${orderId}\nBill to:\n${customerName}\n${addressBlock}`;
  }
}
```

### SOLUTION FILES

**File 1: `Address.ts` (solution — the new Value Object)**
```typescript
// SOLUTION: Replace Primitive with Object + Introduce Parameter Object
// Address is now a proper Value Object with its own behavior.
export class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly postalCode: string,
    public readonly country: string
  ) {
    this.validate(); // Validation lives HERE, not scattered in callers
  }

  private validate(): void {
    if (this.country === 'EG' && !/^\d{5,6}$/.test(this.postalCode)) {
      throw new Error('Invalid Egyptian postal code');
    }
    if (this.country === 'US' && !/^\d{5}(-\d{4})?$/.test(this.postalCode)) {
      throw new Error('Invalid US ZIP code');
    }
  }

  // Formatting logic lives HERE, defined once, used everywhere
  format(): string {
    return `${this.street}, ${this.city} ${this.postalCode}, ${this.country}`;
  }

  formatLabel(): string {
    return `${this.street}\n${this.city} ${this.postalCode}\n${this.country}`;
  }

  isSameCountryAs(other: Address): boolean {
    return this.country === other.country;
  }
}
```

**File 2: `CustomerService.ts` (solution)**
```typescript
import { Address } from './Address';

export class CustomerService {
  async createCustomer(name: string, email: string, address: Address): Promise<{ customerId: string }> {
    // Validation already happened in Address constructor
    const customerId = `CUST-${Date.now()}`;
    console.log(`Created customer ${name} at ${address.format()}`);
    return { customerId };
  }

  async updateAddress(customerId: string, address: Address): Promise<void> {
    console.log(`Updated address for ${customerId}: ${address.format()}`);
  }
}
```

**File 3: `ShippingService.ts` (solution)**
```typescript
import { Address } from './Address';

export class ShippingService {
  // 2 parameters instead of 9
  calculateRate(weightKg: number, origin: Address, destination: Address): number {
    const baseRate = origin.isSameCountryAs(destination) ? 15 : 45;
    return baseRate * weightKg;
  }

  formatShippingLabel(recipientName: string, address: Address): string {
    return `${recipientName}\n${address.formatLabel()}`;
  }
}
```

**File 4: `InvoiceService.ts` (solution)**
```typescript
import { Address } from './Address';

export class InvoiceService {
  generateInvoice(orderId: string, customerName: string, billingAddress: Address): string {
    return `INVOICE #${orderId}\nBill to:\n${customerName}\n${billingAddress.formatLabel()}`;
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Primitive Address":

TWO SMELLS NAMED (30 points, 15 each):
1. Primitive Obsession (Fowler Ch. 3, p. 88) — address fields are strings/primitives
   when they should be a proper type. Accept: "stringly typed", "primitives for
   domain concepts."
2. Data Clumps (Fowler Ch. 3, p. 87) — the four address fields always travel together.
   Fowler: "If you deleted one of the data values and the others wouldn't make sense,
   it's a sure sign you have an object trying to be born." Accept: "parameters that
   always appear together", "grouped data with no home."

WHY IT'S A PROBLEM (20 points):
Must mention at least ONE of:
- Validation is duplicated and will drift (the postal code regex is in 2+ places)
- 9-parameter function signatures are hard to read and maintain
- Formatting is duplicated with slight inconsistencies
- A postal code format change requires hunting across the codebase

PROPOSED FIX (50 points):
Must create an Address class/type. Award points for:
- Names the new class Address or similar (10 pts)
- Moves validation INTO the Address constructor/factory (15 pts)
- Moves formatting logic INTO Address as methods (15 pts)
- Identifies the Fowler techniques: Replace Primitive with Object (p. 174)
  and/or Introduce Parameter Object (p. 140) (10 pts)

DO NOT PASS if student only proposes defining a TypeScript interface/type
without moving validation and formatting behavior into it. An interface is
not enough — the smell requires an object with behavior.
```

---

## PROBLEM 04 — "The Repeated Switch"

| Field | Value |
|---|---|
| Slug | `the-repeated-switch` |
| Difficulty | Medium |
| Category | `gof_behavioral` |
| Fowler Reference | Chapter 3, p. 91: *Repeated Switches*; Chapter 10: *Replace Conditional with Polymorphism* (p. 272) |
| Primary Smell | Repeated Switches |
| Primary Refactoring | Replace Conditional with Polymorphism (p. 272), Replace Type Code with Subclasses (p. 362) |
| Tags | `repeated-switches`, `polymorphism`, `OCP`, `replace-type-code` |

### SCENARIO DESCRIPTION

```markdown
## The Employee Switcher

A payroll system manages three types of employees: `manager`, `engineer`, and
`salesperson`. Whenever business logic changes for one type, a developer has to
find and update the same `switch(employee.type)` pattern in three different
places across two files.

Last month, adding a new `contractor` type caused a bug because one of the
switch statements was missed in a code review.

## Your Task

1. Name the **code smell** (Fowler's exact term from Chapter 3).
2. Explain what makes repeated switch statements specifically dangerous as the
   codebase grows.
3. Describe the refactoring. What pattern do you introduce? What does the class
   hierarchy look like? Be specific about which methods move where.
```

### PROBLEM FILES

**File 1: `Employee.ts`**
```typescript
export interface Employee {
  id: string;
  name: string;
  type: 'manager' | 'engineer' | 'salesperson';
  baseSalary: number;
  salesRevenue?: number;      // only relevant for salesperson
  teamSize?: number;          // only relevant for manager
  certifications?: string[];  // only relevant for engineer
}
```

**File 2: `EmployeeService.ts`**
```typescript
import { Employee } from './Employee';

export class EmployeeService {

  // Switch #1: Bonus calculation
  calculateBonus(employee: Employee): number {
    switch (employee.type) {
      case 'manager':
        return employee.baseSalary * 0.20 * (employee.teamSize || 1) * 0.01;
      case 'engineer':
        const certBonus = (employee.certifications?.length || 0) * 500;
        return employee.baseSalary * 0.10 + certBonus;
      case 'salesperson':
        return (employee.salesRevenue || 0) * 0.05;
      default:
        return 0;
    }
  }

  // Switch #2: Title/grade display
  getTitle(employee: Employee): string {
    switch (employee.type) {
      case 'manager':
        const size = employee.teamSize || 0;
        if (size >= 10) return 'Senior Manager';
        if (size >= 5)  return 'Manager';
        return 'Team Lead';
      case 'engineer':
        const certs = employee.certifications?.length || 0;
        if (certs >= 3) return 'Principal Engineer';
        if (certs >= 1) return 'Senior Engineer';
        return 'Engineer';
      case 'salesperson':
        return (employee.salesRevenue || 0) > 500000 ? 'Senior Salesperson' : 'Salesperson';
      default:
        return 'Employee';
    }
  }

  // Switch #3: Permissions
  getPermissions(employee: Employee): string[] {
    switch (employee.type) {
      case 'manager':
        return ['read', 'write', 'approve_budget', 'hire'];
      case 'engineer':
        return ['read', 'write', 'deploy'];
      case 'salesperson':
        return ['read', 'create_deal', 'view_pipeline'];
      default:
        return ['read'];
    }
  }
}
```

**File 3: `EmployeeFormatter.ts`**
```typescript
import { Employee } from './Employee';

export class EmployeeFormatter {

  // Switch #4: Different format for paystubs per type
  formatPaystub(employee: Employee): string {
    const base = `Employee: ${employee.name} | Base: $${employee.baseSalary}`;

    switch (employee.type) {
      case 'manager':
        return `${base} | Team Size: ${employee.teamSize} | Type: Management`;
      case 'engineer':
        return `${base} | Certs: ${employee.certifications?.join(', ')} | Type: Engineering`;
      case 'salesperson':
        return `${base} | Revenue: $${employee.salesRevenue} | Type: Sales`;
      default:
        return base;
    }
  }
}
```

### SOLUTION FILES

**File 1: `Employee.ts` (solution — base class)**
```typescript
// SOLUTION: Replace Type Code with Subclasses + Replace Conditional with Polymorphism
// Each type becomes its own class. switch statements are eliminated entirely.
export abstract class Employee {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly baseSalary: number
  ) {}

  abstract calculateBonus(): number;
  abstract getTitle(): string;
  abstract getPermissions(): string[];
  abstract formatPaystub(): string;
}
```

**File 2: `Manager.ts` (solution)**
```typescript
import { Employee } from './Employee';

export class Manager extends Employee {
  constructor(id: string, name: string, baseSalary: number, public readonly teamSize: number) {
    super(id, name, baseSalary);
  }

  calculateBonus(): number {
    return this.baseSalary * 0.20 * this.teamSize * 0.01;
  }

  getTitle(): string {
    if (this.teamSize >= 10) return 'Senior Manager';
    if (this.teamSize >= 5)  return 'Manager';
    return 'Team Lead';
  }

  getPermissions(): string[] {
    return ['read', 'write', 'approve_budget', 'hire'];
  }

  formatPaystub(): string {
    return `Employee: ${this.name} | Base: $${this.baseSalary} | Team Size: ${this.teamSize} | Type: Management`;
  }
}
```

**File 3: `Engineer.ts` (solution)**
```typescript
import { Employee } from './Employee';

export class Engineer extends Employee {
  constructor(id: string, name: string, baseSalary: number, public readonly certifications: string[]) {
    super(id, name, baseSalary);
  }

  calculateBonus(): number {
    return this.baseSalary * 0.10 + this.certifications.length * 500;
  }

  getTitle(): string {
    if (this.certifications.length >= 3) return 'Principal Engineer';
    if (this.certifications.length >= 1) return 'Senior Engineer';
    return 'Engineer';
  }

  getPermissions(): string[] {
    return ['read', 'write', 'deploy'];
  }

  formatPaystub(): string {
    return `Employee: ${this.name} | Base: $${this.baseSalary} | Certs: ${this.certifications.join(', ')} | Type: Engineering`;
  }
}
```

**File 4: `Salesperson.ts` (solution)**
```typescript
import { Employee } from './Employee';

export class Salesperson extends Employee {
  constructor(id: string, name: string, baseSalary: number, public readonly salesRevenue: number) {
    super(id, name, baseSalary);
  }

  calculateBonus(): number {
    return this.salesRevenue * 0.05;
  }

  getTitle(): string {
    return this.salesRevenue > 500000 ? 'Senior Salesperson' : 'Salesperson';
  }

  getPermissions(): string[] {
    return ['read', 'create_deal', 'view_pipeline'];
  }

  formatPaystub(): string {
    return `Employee: ${this.name} | Base: $${this.baseSalary} | Revenue: $${this.salesRevenue} | Type: Sales`;
  }
}
// Adding 'Contractor' now means: create Contractor extends Employee.
// Zero changes to existing classes. Zero risk of missed case.
```

### RUBRIC

```
GRADING CRITERIA for "The Repeated Switch":

SMELL NAME (30 points):
Must name "Repeated Switches" (Fowler's exact Ch. 3 term).
Accept also: "Switch Statements smell," "duplicate conditionals."
Do NOT accept just "tight coupling" or "OCP violation" as the primary answer.
Award 15 pts if they describe the problem correctly without naming the smell.

WHY IT'S DANGEROUS (20 points):
Must explain that adding a new type ('contractor') requires finding and updating
ALL switch statements. Miss one and you have a bug.
Fowler: "whenever you add a clause, you have to find all the switches and update them."

PROPOSED FIX (50 points):
25 pts: Names "Replace Conditional with Polymorphism" (Fowler p. 272) OR
        "Replace Type Code with Subclasses" (Fowler p. 362).
25 pts: Describes the hierarchy — abstract Employee with abstract methods
        calculateBonus(), getTitle(), getPermissions(), formatPaystub().
        Each type becomes a subclass that overrides these.

The KEY INSIGHT for full marks: when you add a new type, you only create a
NEW class — you do NOT modify any existing class. This is the OCP in action.

Award 30/50 if they say "use polymorphism/subclasses" without specifying
which methods become abstract or which classes are created.

DO NOT PASS if they propose a map/dictionary of functions as the fix without
explaining how it eliminates the switch statements in all 4 places.
```

---

## PROBLEM 05 — "The Shotgun Discount"

| Field | Value |
|---|---|
| Slug | `the-shotgun-discount` |
| Difficulty | Medium |
| Category | `solid` |
| Fowler Reference | Chapter 3, p. 82: *Shotgun Surgery* |
| Primary Smell | Shotgun Surgery |
| Primary Refactoring | Move Function (p. 198), Move Field (p. 207), Combine Functions into Class (p. 144) |
| Tags | `shotgun-surgery`, `move-function`, `cohesion`, `DRY` |

### SCENARIO DESCRIPTION

```markdown
## The Scattered Discount

The e-commerce platform offers a 15% discount to VIP customers. This rule is
encoded in the codebase — but nobody knows exactly where.

When a business analyst asked "how does the VIP discount work?", three engineers
each pointed to a different file. When the discount rate was changed from 15%
to 20% last quarter, a developer had to make 4 separate edits across 4 files.
One edit was missed, causing VIP customers to see inconsistent prices on their
invoices vs. their cart.

## Your Task

1. Name this **code smell** (Fowler's exact term from Chapter 3).
2. Explain how this smell causes bugs specifically (not just "it's hard to maintain").
3. Describe the refactoring. Where does the discount logic end up? What does the
   consolidated code look like? Name the Fowler refactoring technique(s).
```

### PROBLEM FILES

**File 1: `CartService.ts`**
```typescript
import { Cart, Customer } from './types';

export class CartService {
  calculateTotal(cart: Cart, customer: Customer): number {
    let subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // VIP discount — is this the source of truth?
    if (customer.membershipTier === 'vip') {
      subtotal = subtotal * 0.85; // 15% off
    }

    return subtotal;
  }
}
```

**File 2: `OrderService.ts`**
```typescript
import { Order, Customer } from './types';

export class OrderService {
  createOrder(customerId: string, items: any[], customer: Customer): Order {
    const baseTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    // VIP discount applied again — slightly different implementation
    const discountedTotal = customer.membershipTier === 'vip'
      ? baseTotal - (baseTotal * 0.15)  // same 15%, different expression
      : baseTotal;

    return { id: `ORD-${Date.now()}`, customerId, total: discountedTotal, items };
  }
}
```

**File 3: `InvoiceBuilder.ts`**
```typescript
import { Order, Customer } from './types';

export class InvoiceBuilder {
  buildInvoice(order: Order, customer: Customer): string {
    // The discount is hard-coded AGAIN, separately from OrderService
    const discountLine = customer.membershipTier === 'vip'
      ? `VIP Discount (15%): -$${(order.total * 0.15 / 0.85).toFixed(2)}\n`
      : '';

    return `Invoice #${order.id}\nTotal: $${order.total.toFixed(2)}\n${discountLine}`;
  }
}
```

**File 4: `EmailFormatter.ts`**
```typescript
import { Customer } from './types';

export class EmailFormatter {
  formatOrderConfirmation(orderId: string, total: number, customer: Customer): string {
    // A fourth place that "knows" about the VIP discount
    const savingsMsg = customer.membershipTier === 'vip'
      ? ` (includes your 15% VIP member discount)`
      : '';

    return `Your order ${orderId} total is $${total.toFixed(2)}${savingsMsg}. Thank you!`;
  }
}
```

**File 5: `types.ts`**
```typescript
export interface Customer {
  id: string;
  name: string;
  email: string;
  membershipTier: 'standard' | 'vip' | 'enterprise';
}

export interface CartItem {
  productId: string;
  price: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

export interface Order {
  id: string;
  customerId: string;
  total: number;
  items: any[];
}
```

### SOLUTION FILES

**File 1: `Customer.ts` (solution — logic moves to Customer)**
```typescript
// SOLUTION: Move Function — discount logic moves into Customer, its natural home.
// One place to change. One place to read. One source of truth.
export class Customer {
  private static readonly VIP_DISCOUNT_RATE     = 0.15;
  private static readonly ENTERPRISE_DISCOUNT_RATE = 0.20;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly membershipTier: 'standard' | 'vip' | 'enterprise'
  ) {}

  getDiscountRate(): number {
    switch (this.membershipTier) {
      case 'vip':        return Customer.VIP_DISCOUNT_RATE;
      case 'enterprise': return Customer.ENTERPRISE_DISCOUNT_RATE;
      default:           return 0;
    }
  }

  applyDiscount(amount: number): number {
    return amount * (1 - this.getDiscountRate());
  }

  discountDescription(): string {
    const rate = this.getDiscountRate();
    if (rate === 0) return '';
    return `${this.membershipTier.toUpperCase()} Discount (${rate * 100}%)`;
  }
}
```

**File 2: `CartService.ts` (solution)**
```typescript
import { Customer } from './Customer';
import { Cart } from './types';

export class CartService {
  calculateTotal(cart: Cart, customer: Customer): number {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return customer.applyDiscount(subtotal);
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Shotgun Discount":

SMELL NAME (30 points):
Must name "Shotgun Surgery" (Fowler Ch. 3, p. 82).
Fowler: "when every time you make a change, you have to make a lot of little
edits to a lot of different classes."
Accept also: "scattered logic", "change requires edits in many places."
Do NOT accept "code duplication" or "DRY violation" as the primary answer —
those are related but Shotgun Surgery is the named smell here.

BUG MECHANISM (20 points):
Must explain the specific failure mode: when the rate changes from 15% to 20%,
a developer MUST update all 4 locations. Forgetting even one causes customers
to see inconsistent prices in the cart vs. the invoice vs. the confirmation
email. This is not just "hard to maintain" — it causes observable production bugs.

PROPOSED FIX (50 points):
25 pts: Names Move Function (Fowler p. 198) — the discount logic moves into
        the Customer class/object where it belongs.
25 pts: Describes the result: Customer has getDiscountRate() and applyDiscount(amount)
        methods. All other services call customer.applyDiscount() instead of
        implementing the rate themselves. Changing the rate is now a 1-line edit.

Award 30/50 if they say "centralize the discount in one place" without naming
Move Function or identifying Customer as the natural home.

BONUS (5 extra points, uncapped at 100):
Student notes that the discount rate constant (0.15) should also be extracted
as a named constant rather than a magic number.
```

---

## PROBLEM 06 — "The Divergent HR Manager"

| Field | Value |
|---|---|
| Slug | `the-divergent-hr-manager` |
| Difficulty | Medium |
| Category | `solid` |
| Fowler Reference | Chapter 3, p. 78: *Divergent Change*; Chapter 7: *Extract Class* (p. 182) |
| Primary Smell | Divergent Change |
| Primary Refactoring | Extract Class (p. 182) |
| Tags | `divergent-change`, `extract-class`, `SRP`, `large-class` |

### SCENARIO DESCRIPTION

```markdown
## The HR God Class

The `HRManager` class was written when the company had 5 employees. Now it has
200, and three different teams complain about stepping on each other's changes.

The finance team changes `HRManager` every time payroll rules update.
The operations team changes it every time vacation policy changes.
The management team changes it every time they want a new report format.

A senior engineer said:
> *"This class has at least three reasons to change, and they're completely
> unrelated to each other. When two teams make changes at the same time,
> we get merge conflicts every sprint."*

## Your Task

1. Name the **specific code smell** (Fowler's exact term).
2. Identify the **distinct reasons** this class has to change.
3. Describe the **refactoring** — what new classes do you extract, what does
   each class own, and which Fowler technique applies?
```

### PROBLEM FILES

**File 1: `HRManager.ts`**
```typescript
import { Employee, VacationRequest, PayrollEntry } from './types';

export class HRManager {
  private employees: Employee[] = [];
  private vacationRequests: VacationRequest[] = [];

  // -------- EMPLOYEE DATA MANAGEMENT --------
  addEmployee(employee: Employee): void {
    this.employees.push(employee);
  }

  getEmployee(id: string): Employee | undefined {
    return this.employees.find(e => e.id === id);
  }

  listEmployees(): Employee[] {
    return [...this.employees];
  }

  terminateEmployee(id: string): void {
    this.employees = this.employees.filter(e => e.id !== id);
  }

  // -------- PAYROLL CALCULATION --------
  // Changes when: tax law changes, bonus structure changes, salary bands update
  calculateMonthlyPayroll(employeeId: string): PayrollEntry {
    const employee = this.getEmployee(employeeId)!;
    const grossPay = employee.baseSalary / 12;
    const taxRate  = employee.baseSalary > 120000 ? 0.30 : 0.22;
    const tax      = grossPay * taxRate;
    const socialInsurance = grossPay * 0.11;
    const netPay   = grossPay - tax - socialInsurance;

    return {
      employeeId,
      grossPay: Math.round(grossPay * 100) / 100,
      tax:      Math.round(tax * 100) / 100,
      netPay:   Math.round(netPay * 100) / 100,
    };
  }

  runMonthlyPayroll(): PayrollEntry[] {
    return this.employees.map(e => this.calculateMonthlyPayroll(e.id));
  }

  // -------- VACATION TRACKING --------
  // Changes when: vacation policy changes (allowance days, approval rules)
  requestVacation(employeeId: string, startDate: Date, endDate: Date): VacationRequest {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const employee = this.getEmployee(employeeId)!;
    const usedDays = this.vacationRequests
      .filter(r => r.employeeId === employeeId && r.status === 'approved')
      .reduce((sum, r) => sum + r.days, 0);

    const annualAllowance = employee.seniorityYears >= 5 ? 25 : 21;
    if (usedDays + days > annualAllowance) {
      throw new Error(`Exceeds annual vacation allowance of ${annualAllowance} days`);
    }

    const request: VacationRequest = {
      id: `VAC-${Date.now()}`,
      employeeId, startDate, endDate, days, status: 'pending',
    };
    this.vacationRequests.push(request);
    return request;
  }

  approveVacation(requestId: string): void {
    const request = this.vacationRequests.find(r => r.id === requestId);
    if (request) request.status = 'approved';
  }

  getRemainingVacationDays(employeeId: string): number {
    const employee = this.getEmployee(employeeId)!;
    const annualAllowance = employee.seniorityYears >= 5 ? 25 : 21;
    const usedDays = this.vacationRequests
      .filter(r => r.employeeId === employeeId && r.status === 'approved')
      .reduce((sum, r) => sum + r.days, 0);
    return annualAllowance - usedDays;
  }

  // -------- REPORTING --------
  // Changes when: management wants different metrics, new CSV format, new columns
  generateHeadcountReport(): string {
    const byDepartment = this.employees.reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let report = 'HEADCOUNT REPORT\n';
    for (const [dept, count] of Object.entries(byDepartment)) {
      report += `${dept}: ${count} employees\n`;
    }
    return report;
  }

  generatePayrollSummaryReport(): string {
    const entries = this.runMonthlyPayroll();
    const total   = entries.reduce((sum, e) => sum + e.netPay, 0);
    return `PAYROLL SUMMARY\nTotal Net Pay: $${total.toFixed(2)}\nEmployees: ${entries.length}`;
  }
}
```

**File 2: `types.ts`**
```typescript
export interface Employee {
  id: string;
  name: string;
  department: string;
  baseSalary: number;
  seniorityYears: number;
}

export interface VacationRequest {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PayrollEntry {
  employeeId: string;
  grossPay: number;
  tax: number;
  netPay: number;
}
```

### SOLUTION FILES

**File 1: `EmployeeRepository.ts` (solution)**
```typescript
import { Employee } from './types';

export class EmployeeRepository {
  private employees: Employee[] = [];

  add(employee: Employee): void { this.employees.push(employee); }
  getById(id: string): Employee | undefined { return this.employees.find(e => e.id === id); }
  list(): Employee[] { return [...this.employees]; }
  remove(id: string): void { this.employees = this.employees.filter(e => e.id !== id); }
}
```

**File 2: `PayrollService.ts` (solution)**
```typescript
import { Employee, PayrollEntry } from './types';

export class PayrollService {
  calculate(employee: Employee): PayrollEntry {
    const grossPay = employee.baseSalary / 12;
    const taxRate  = employee.baseSalary > 120000 ? 0.30 : 0.22;
    const tax      = grossPay * taxRate;
    const netPay   = grossPay - tax - (grossPay * 0.11);
    return { employeeId: employee.id, grossPay: Math.round(grossPay*100)/100,
             tax: Math.round(tax*100)/100, netPay: Math.round(netPay*100)/100 };
  }

  runMonthlyPayroll(employees: Employee[]): PayrollEntry[] {
    return employees.map(e => this.calculate(e));
  }
}
```

**File 3: `VacationTracker.ts` (solution)**
```typescript
import { Employee, VacationRequest } from './types';

export class VacationTracker {
  private requests: VacationRequest[] = [];

  private getAllowance(employee: Employee): number {
    return employee.seniorityYears >= 5 ? 25 : 21;
  }

  requestVacation(employee: Employee, startDate: Date, endDate: Date): VacationRequest {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
    const usedDays = this.getUsedDays(employee.id);
    if (usedDays + days > this.getAllowance(employee)) {
      throw new Error(`Exceeds annual vacation allowance of ${this.getAllowance(employee)} days`);
    }
    const request: VacationRequest = {
      id: `VAC-${Date.now()}`, employeeId: employee.id,
      startDate, endDate, days, status: 'pending',
    };
    this.requests.push(request);
    return request;
  }

  approve(requestId: string): void {
    const r = this.requests.find(r => r.id === requestId);
    if (r) r.status = 'approved';
  }

  private getUsedDays(employeeId: string): number {
    return this.requests
      .filter(r => r.employeeId === employeeId && r.status === 'approved')
      .reduce((sum, r) => sum + r.days, 0);
  }

  getRemainingDays(employee: Employee): number {
    return this.getAllowance(employee) - this.getUsedDays(employee.id);
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Divergent HR Manager":

SMELL NAME (25 points):
Must name "Divergent Change" (Fowler Ch. 3, p. 78).
Fowler: "when one module is often changed in different ways for different reasons."
Accept also: "too many reasons to change", "violates SRP."
Do NOT accept "Large Class" as the primary answer — Large Class is a symptom,
Divergent Change is the smell for this specific scenario.

THREE REASONS IDENTIFIED (25 points, ~8 each):
Student must identify AT LEAST 2 of the 3 distinct change axes:
1. Payroll rules change (tax rates, bonus structure, salary bands)
2. Vacation policy changes (allowance days, approval rules, seniority thresholds)
3. Reporting format/metrics change (management wants different output)

PROPOSED FIX (50 points):
Must propose Extract Class (Fowler p. 182).
25 pts: Names the technique "Extract Class"
25 pts: Describes the resulting classes:
- PayrollService (owns calculateMonthlyPayroll, runMonthlyPayroll, tax logic)
- VacationTracker (owns requestVacation, approveVacation, getRemainingDays)
- HRReportService (owns generateHeadcountReport, generatePayrollSummary)
- Optional: EmployeeRepository (owns add/get/list/remove)

Award 35/50 if they describe the splits correctly without naming Extract Class.
Award 20/50 if they say "break it into smaller classes" without specifying which
methods go where.

KEY INSIGHT for full marks: the student explains that after splitting, a tax law
change ONLY touches PayrollService, a vacation policy change ONLY touches
VacationTracker, and a report format change ONLY touches HRReportService.
The classes are now stable with respect to changes in other domains.
```

---

## PROBLEM 07 — "The Chain Gang"

| Field | Value |
|---|---|
| Slug | `the-chain-gang` |
| Difficulty | Easy |
| Category | `gof_structural` |
| Fowler Reference | Chapter 3, p. 98: *Message Chains*; Chapter 7: *Hide Delegate* (p. 189) |
| Primary Smell | Message Chains |
| Primary Refactoring | Hide Delegate (p. 189) |
| Tags | `message-chains`, `hide-delegate`, `Law-of-Demeter`, `coupling` |

### SCENARIO DESCRIPTION

```markdown
## The Chain of Getters

A shipping platform has `Order`, `Customer`, and `Address` objects. The
`ShippingService` needs to access customer address details to calculate routes
and generate labels.

A code reviewer left this comment on a pull request:
> *"Every method in ShippingService is navigating three levels of object
> structure. If the Customer class ever restructures how it stores addresses,
> we'll need to change every single method in ShippingService."*

## Your Task

1. Name this **code smell** (Fowler's exact term).
2. Explain why chains of method calls increase coupling beyond what's necessary.
3. Name the **refactoring** and describe what the code looks like after. Be
   specific about what new methods are added and where they live.
```

### PROBLEM FILES

**File 1: `Order.ts`**
```typescript
import { Customer } from './Customer';

export class Order {
  constructor(
    public readonly id: string,
    public readonly customer: Customer,
    public readonly items: Array<{ productId: string; quantity: number; price: number }>,
    public readonly createdAt: Date
  ) {}

  getCustomer(): Customer { return this.customer; }
  getId(): string { return this.id; }
  getTotal(): number { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); }
}
```

**File 2: `Customer.ts`**
```typescript
import { Address } from './Address';

export class Customer {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly shippingAddress: Address,
    public readonly newsletterEnabled: boolean
  ) {}

  getAddress(): Address { return this.shippingAddress; }
  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
  isNewsletterEnabled(): boolean { return this.newsletterEnabled; }
}
```

**File 3: `Address.ts`**
```typescript
export class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly postalCode: string,
    public readonly country: string
  ) {}

  getCity(): string { return this.city; }
  getPostalCode(): string { return this.postalCode; }
  getCountry(): string { return this.country; }
  getStreet(): string { return this.street; }
}
```

**File 4: `ShippingService.ts`**
```typescript
import { Order } from './Order';

export class ShippingService {
  // Smell: every method chains through order → customer → address
  // This creates coupling to the STRUCTURE of Customer and Address

  calculateShippingZone(order: Order): string {
    // Chain: order.getCustomer().getAddress().getCountry()
    const country = order.getCustomer().getAddress().getCountry();
    if (country === 'EG') return 'DOMESTIC';
    if (['SA', 'AE', 'KW'].includes(country)) return 'GCC';
    return 'INTERNATIONAL';
  }

  generateShippingLabel(order: Order): string {
    // Chain repeated: order.getCustomer().getAddress().*
    const name       = order.getCustomer().getName();
    const street     = order.getCustomer().getAddress().getStreet();
    const city       = order.getCustomer().getAddress().getCity();
    const postalCode = order.getCustomer().getAddress().getPostalCode();
    const country    = order.getCustomer().getAddress().getCountry();

    return `${name}\n${street}\n${city} ${postalCode}\n${country}`;
  }

  shouldSendShippingUpdate(order: Order): boolean {
    // Chain to a completely different part of Customer
    return order.getCustomer().isNewsletterEnabled();
  }

  calculateDeliveryDays(order: Order): number {
    const country = order.getCustomer().getAddress().getCountry();
    if (country === 'EG') return 2;
    if (['SA', 'AE'].includes(country)) return 5;
    return 14;
  }
}
```

### SOLUTION FILES

**File 1: `Order.ts` (solution)**
```typescript
import { Customer } from './Customer';

export class Order {
  constructor(
    public readonly id: string,
    private readonly customer: Customer,
    public readonly items: Array<{ productId: string; quantity: number; price: number }>,
    public readonly createdAt: Date
  ) {}

  getId(): string { return this.id; }
  getTotal(): number { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); }
  getCustomerName(): string { return this.customer.getName(); }

  // SOLUTION: Hide Delegate — Order exposes what callers NEED from Customer/Address.
  // ShippingService now only talks to Order, not to Customer or Address.
  getShippingCountry(): string  { return this.customer.getAddress().getCountry(); }
  getShippingCity(): string     { return this.customer.getAddress().getCity(); }
  getShippingPostalCode(): string { return this.customer.getAddress().getPostalCode(); }
  getShippingStreet(): string   { return this.customer.getAddress().getStreet(); }
  isCustomerSubscribedToUpdates(): boolean { return this.customer.isNewsletterEnabled(); }
}
```

**File 2: `ShippingService.ts` (solution)**
```typescript
import { Order } from './Order';

export class ShippingService {
  // No chains. ShippingService talks only to Order.
  // If Customer restructures how it stores Address, only Order changes — not here.

  calculateShippingZone(order: Order): string {
    const country = order.getShippingCountry();
    if (country === 'EG') return 'DOMESTIC';
    if (['SA', 'AE', 'KW'].includes(country)) return 'GCC';
    return 'INTERNATIONAL';
  }

  generateShippingLabel(order: Order): string {
    return `${order.getCustomerName()}\n${order.getShippingStreet()}\n` +
           `${order.getShippingCity()} ${order.getShippingPostalCode()}\n${order.getShippingCountry()}`;
  }

  shouldSendShippingUpdate(order: Order): boolean {
    return order.isCustomerSubscribedToUpdates();
  }

  calculateDeliveryDays(order: Order): number {
    const country = order.getShippingCountry();
    if (country === 'EG') return 2;
    if (['SA', 'AE'].includes(country)) return 5;
    return 14;
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Chain Gang":

SMELL NAME (30 points):
Must name "Message Chains" (Fowler Ch. 3, p. 98).
Accept also: "Law of Demeter violation", "train wreck", "method chaining smell."
Award 15 pts for correctly describing the problem without naming the smell.

WHY IT COUPLES (25 points):
Must explain: ShippingService is coupled not just to Order, but to Customer AND
Address. If Customer ever changes how it stores its address (e.g., splits into
billingAddress and shippingAddress), ShippingService must change too even though
it has no reason to care about Customer's internal structure.
Fowler: "navigating this way means the client is coupled to the structure of
the navigation. Any change to the intermediate relationships causes the client
to have to change."

PROPOSED FIX (45 points):
Must name "Hide Delegate" (Fowler p. 189).
20 pts: Names Hide Delegate
25 pts: Describes adding delegation methods to Order:
  Order.getShippingCountry() → delegates to customer.getAddress().getCountry()
  Order.getShippingStreet() → etc.
  Order.isCustomerSubscribedToUpdates() → delegates to customer.isNewsletterEnabled()
  ShippingService then only calls methods on Order directly.

Award 25/45 if they describe adding methods to Order without naming Hide Delegate.

KEY INSIGHT for full marks: after the refactoring, if Customer is restructured,
ONLY Order changes. ShippingService is shielded from the change.
```

---

## PROBLEM 08 — "The Hollow Product"

| Field | Value |
|---|---|
| Slug | `the-hollow-product` |
| Difficulty | Medium |
| Category | `solid` |
| Fowler Reference | Chapter 3, p. 101: *Data Class*; Chapter 7: *Move Function* via Extract Class |
| Primary Smell | Data Class |
| Primary Refactoring | Move Function (p. 198), Encapsulate Record (p. 162) |
| Tags | `data-class`, `move-function`, `anemic-domain-model`, `encapsulation` |

### SCENARIO DESCRIPTION

```markdown
## The Anemic Product

The Product class has 8 getter/setter methods and nothing else. All the real
logic lives in `ProductManager` — which accesses Product exclusively through
those getters.

A team member flagged this in a design review:
> *"ProductManager knows everything about how Product works internally. If we
> add a field to Product, we always have to update ProductManager too. The
> Product class is just a struct with decoration."*

## Your Task

1. Name the **code smell** (Fowler's exact term from Chapter 3).
2. Explain why this pattern is problematic specifically in terms of where behavior lives.
3. Describe the refactoring: which methods move from `ProductManager` into `Product`,
   and why does that make sense? Name the Fowler technique.
```

### PROBLEM FILES

**File 1: `Product.ts`**
```typescript
// This class is a "Data Class" — just a data holder. No behavior.
export class Product {
  private id: string;
  private name: string;
  private basePrice: number;
  private stockQuantity: number;
  private category: string;
  private taxRate: number;
  private discountPercent: number;
  private isActive: boolean;

  constructor(data: {
    id: string; name: string; basePrice: number; stockQuantity: number;
    category: string; taxRate: number; discountPercent: number; isActive: boolean;
  }) {
    Object.assign(this, data);
  }

  getId(): string { return this.id; }
  getName(): string { return this.name; }
  getBasePrice(): number { return this.basePrice; }
  getStockQuantity(): number { return this.stockQuantity; }
  setStockQuantity(qty: number): void { this.stockQuantity = qty; }
  getCategory(): string { return this.category; }
  getTaxRate(): number { return this.taxRate; }
  getDiscountPercent(): number { return this.discountPercent; }
  setDiscountPercent(pct: number): void { this.discountPercent = pct; }
  isProductActive(): boolean { return this.isActive; }
  setIsActive(active: boolean): void { this.isActive = active; }
}
```

**File 2: `ProductManager.ts`**
```typescript
import { Product } from './Product';

// All behavior that BELONGS on Product lives here instead
export class ProductManager {

  // This logic uses only Product's data — it belongs ON Product
  calculateFinalPrice(product: Product): number {
    const basePrice      = product.getBasePrice();
    const discountAmount = basePrice * (product.getDiscountPercent() / 100);
    const discountedPrice = basePrice - discountAmount;
    const tax = discountedPrice * product.getTaxRate();
    return Math.round((discountedPrice + tax) * 100) / 100;
  }

  // This logic uses only Product's data — it belongs ON Product
  isInStock(product: Product): boolean {
    return product.isProductActive() && product.getStockQuantity() > 0;
  }

  // This logic uses only Product's data — it belongs ON Product
  canApplyBulkDiscount(product: Product, quantity: number): boolean {
    return product.isProductActive()
      && product.getStockQuantity() >= quantity
      && quantity >= 10;
  }

  // This logic uses only Product's data — it belongs ON Product
  formatDisplayTitle(product: Product): string {
    const stock = product.getStockQuantity();
    const status = !product.isProductActive() ? ' [DISCONTINUED]'
                 : stock === 0               ? ' [OUT OF STOCK]'
                 : stock < 5                 ? ` [ONLY ${stock} LEFT]`
                 : '';
    return `${product.getName()}${status}`;
  }

  // This is an operation that changes state — belongs ON Product
  decrementStock(product: Product, quantity: number): void {
    const current = product.getStockQuantity();
    if (current < quantity) throw new Error(`Insufficient stock for ${product.getName()}`);
    product.setStockQuantity(current - quantity);
  }
}
```

**File 3: `ProductController.ts`**
```typescript
import { Product } from './Product';
import { ProductManager } from './ProductManager';

export class ProductController {
  private manager = new ProductManager();

  getProductDetails(product: Product) {
    return {
      title:      this.manager.formatDisplayTitle(product),
      price:      this.manager.calculateFinalPrice(product),
      inStock:    this.manager.isInStock(product),
      category:   product.getCategory(),
    };
  }
}
```

### SOLUTION FILES

**File 1: `Product.ts` (solution)**
```typescript
// SOLUTION: Move Function — behavior moves from ProductManager into Product.
// Product is no longer a hollow data container.
export class Product {
  private stockQuantity: number;
  private discountPercent: number;
  private isActive: boolean;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly basePrice: number,
    stockQuantity: number,
    public readonly category: string,
    public readonly taxRate: number,
    discountPercent: number,
    isActive: boolean
  ) {
    this.stockQuantity  = stockQuantity;
    this.discountPercent = discountPercent;
    this.isActive       = isActive;
  }

  // Behavior belongs with the data it uses
  calculateFinalPrice(): number {
    const discounted = this.basePrice * (1 - this.discountPercent / 100);
    return Math.round((discounted + discounted * this.taxRate) * 100) / 100;
  }

  isInStock(): boolean {
    return this.isActive && this.stockQuantity > 0;
  }

  canApplyBulkDiscount(quantity: number): boolean {
    return this.isActive && this.stockQuantity >= quantity && quantity >= 10;
  }

  formatDisplayTitle(): string {
    if (!this.isActive)          return `${this.name} [DISCONTINUED]`;
    if (this.stockQuantity === 0) return `${this.name} [OUT OF STOCK]`;
    if (this.stockQuantity < 5)  return `${this.name} [ONLY ${this.stockQuantity} LEFT]`;
    return this.name;
  }

  decrementStock(quantity: number): void {
    if (this.stockQuantity < quantity) throw new Error(`Insufficient stock for ${this.name}`);
    this.stockQuantity -= quantity;
  }

  applyDiscount(percent: number): void {
    if (percent < 0 || percent > 100) throw new Error('Discount must be 0-100');
    this.discountPercent = percent;
  }

  discontinue(): void { this.isActive = false; }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Hollow Product":

SMELL NAME (30 points):
Must name "Data Class" (Fowler Ch. 3, p. 101).
Fowler: "classes that have fields, getting and setting methods for the fields,
and nothing else. Such classes are dumb data holders and are often being
manipulated in far too much detail by other classes."
Accept also: "anemic domain model" (Evans/Fowler term).
Award 15 pts for describing the pattern correctly without naming it.

WHY IT'S WRONG (20 points):
Must explain: behavior that uses Product's data lives in ProductManager instead
of Product. This means: (1) ProductManager is tightly coupled to Product's
internal fields via getters, (2) when Product gets a new field, ProductManager
must change, (3) the business rules (pricing, stock) are separated from the
data they operate on, making the system harder to reason about.

PROPOSED FIX (50 points):
Must name "Move Function" (Fowler p. 198).
25 pts: Names the technique
25 pts: Describes which functions move: calculateFinalPrice(), isInStock(),
  canApplyBulkDiscount(), formatDisplayTitle(), decrementStock() all move
  INTO Product. They now use `this.*` instead of product.getX().
  ProductManager shrinks to nothing or is deleted.

Award 30/50 if they describe the moves correctly without naming Move Function.

KEY INSIGHT for full marks: after the refactoring, many of the public getters
on Product can be made private or removed entirely, because the only code
that needed them was ProductManager — which no longer exists.
This encapsulation improvement is what Fowler means by "Encapsulate Record."
```

---

## PROBLEM 09 — "The Reluctant Heir"

| Field | Value |
|---|---|
| Slug | `the-reluctant-heir` |
| Difficulty | Hard |
| Category | `gof_structural` |
| Fowler Reference | Chapter 3, p. 102: *Refused Bequest*; Chapter 12: *Replace Superclass with Delegate* (p. 399) |
| Primary Smell | Refused Bequest |
| Primary Refactoring | Replace Superclass with Delegate (p. 399) |
| Tags | `refused-bequest`, `replace-superclass-with-delegate`, `LSP`, `inheritance` |

### SCENARIO DESCRIPTION

```markdown
## The Read-Only Heir

The data access layer has a `Repository` base class with full CRUD operations.
A `ReadOnlyRepository` was created for use by the public-facing API — it should
never allow writes.

The current implementation extends `Repository` and overrides the write methods
to throw errors. A bug was recently filed: a developer called
`publicApiRepo.save(record)` by mistake, and it compiled and passed type-checking
— but exploded at runtime.

A lead engineer said:
> *"If it walks like a Repository and quacks like a Repository, callers expect it
> to support all Repository operations. Our ReadOnlyRepository is lying about
> what it is."*

## Your Task

1. Name the **code smell** (Fowler's exact term from Chapter 3).
2. Explain which LSP (Liskov Substitution Principle) rule is violated and how
   the current design causes runtime failures that the type system cannot catch.
3. Describe the **refactoring** — what changes in the class hierarchy, and which
   Fowler technique(s) apply? Be specific about the resulting structure.
```

### PROBLEM FILES

**File 1: `Repository.ts`**
```typescript
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
}

export class Repository<T extends { id: string }> {
  protected records: Map<string, T> = new Map();

  save(record: T): T {
    this.records.set(record.id, record);
    return record;
  }

  update(id: string, partial: Partial<T>): T {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`Record ${id} not found`);
    const updated = { ...existing, ...partial };
    this.records.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.records.has(id)) throw new Error(`Record ${id} not found`);
    this.records.delete(id);
  }

  findById(id: string): T | null {
    return this.records.get(id) ?? null;
  }

  findAll(options?: QueryOptions): T[] {
    let results = Array.from(this.records.values());
    if (options?.orderBy) {
      results = results.sort((a, b) =>
        String((a as any)[options.orderBy!]).localeCompare(String((b as any)[options.orderBy!]))
      );
    }
    if (options?.offset) results = results.slice(options.offset);
    if (options?.limit)  results = results.slice(0, options.limit);
    return results;
  }
}
```

**File 2: `ReadOnlyRepository.ts`**
```typescript
import { Repository, QueryOptions } from './Repository';

// This subclass refuses 3 out of 5 inherited methods.
// Fowler calls this "Refused Bequest."
export class ReadOnlyRepository<T extends { id: string }> extends Repository<T> {

  // Override write methods to throw — but the type system says these are valid calls!
  override save(_record: T): T {
    throw new Error('ReadOnlyRepository does not support write operations');
  }

  override update(_id: string, _partial: Partial<T>): T {
    throw new Error('ReadOnlyRepository does not support write operations');
  }

  override delete(_id: string): void {
    throw new Error('ReadOnlyRepository does not support write operations');
  }

  // Only these two are actually used:
  override findById(id: string): T | null { return super.findById(id); }
  override findAll(options?: QueryOptions): T[] { return super.findAll(options); }
}
```

**File 3: `PublicApiService.ts`**
```typescript
import { Repository } from './Repository';
import { ReadOnlyRepository } from './ReadOnlyRepository';

interface Product { id: string; name: string; price: number; }

export class PublicApiService {
  // The type annotation says Repository<Product> — so callers CAN call .save()
  // This is the bug: the type system doesn't protect us
  private productRepo: Repository<Product> = new ReadOnlyRepository<Product>();

  getProduct(id: string): Product | null {
    return this.productRepo.findById(id);
  }

  listProducts(): Product[] {
    return this.productRepo.findAll({ orderBy: 'name', limit: 50 });
  }

  // This compiles fine. But it throws at runtime. The type system lied.
  adminBulkUpdate(products: Product[]): void {
    for (const product of products) {
      this.productRepo.save(product); // Runtime Error: not supported
    }
  }
}
```

### SOLUTION FILES

**File 1: `ReadRepository.ts` (solution — interface, not subclass)**
```typescript
import { QueryOptions } from './Repository';

// SOLUTION: Replace Superclass with Delegate
// ReadOnlyRepository is NOT a Repository. It USES a Repository.
// Define only what ReadOnlyRepository actually offers.

export interface ReadRepository<T> {
  findById(id: string): T | null;
  findAll(options?: QueryOptions): T[];
}
```

**File 2: `ReadOnlyRepository.ts` (solution)**
```typescript
import { Repository, QueryOptions } from './Repository';
import { ReadRepository } from './ReadRepository';

export class ReadOnlyRepository<T extends { id: string }> implements ReadRepository<T> {
  // Delegation, not inheritance.
  // ReadOnlyRepository USES a Repository — it doesn't pretend to BE one.
  private delegate: Repository<T>;

  constructor(delegate: Repository<T>) {
    this.delegate = delegate;
  }

  findById(id: string): T | null { return this.delegate.findById(id); }
  findAll(options?: QueryOptions): T[] { return this.delegate.findAll(options); }

  // save(), update(), delete() don't exist here.
  // There is no API to accidentally call.
  // The type system now enforces read-only access at compile time.
}
```

**File 3: `PublicApiService.ts` (solution)**
```typescript
import { ReadRepository } from './ReadRepository';
import { ReadOnlyRepository } from './ReadOnlyRepository';
import { Repository } from './Repository';

interface Product { id: string; name: string; price: number; }

export class PublicApiService {
  // Typed as ReadRepository — it's now IMPOSSIBLE to call .save() here.
  // The type system prevents the bug at compile time.
  private productRepo: ReadRepository<Product>;

  constructor(sourceRepo: Repository<Product>) {
    this.productRepo = new ReadOnlyRepository(sourceRepo);
  }

  getProduct(id: string): Product | null { return this.productRepo.findById(id); }
  listProducts(): Product[] { return this.productRepo.findAll({ orderBy: 'name', limit: 50 }); }

  // adminBulkUpdate() cannot even be written here without a type error.
  // The bug is now impossible.
}
```

### RUBRIC

```
GRADING CRITERIA for "The Reluctant Heir":

SMELL NAME (25 points):
Must name "Refused Bequest" (Fowler Ch. 3, p. 102).
Fowler: "Subclasses get to inherit the methods and data of their parents. But
what if they don't want or need what they are given?"
Accept: "wrong inheritance", "violates LSP."
Award 10 pts for describing the pattern without naming the smell.

LSP VIOLATION EXPLANATION (25 points):
The Liskov Substitution Principle says: anywhere a Repository<T> is expected,
a ReadOnlyRepository<T> must be substitutable. But ReadOnlyRepository violates
this by throwing on methods the parent class supports.
The type system says these calls are valid (save() is on Repository<T>), but they
explode at runtime. This is the "stronger precondition" LSP violation.

PROPOSED FIX (50 points):
Must name "Replace Superclass with Delegate" (Fowler p. 399).
25 pts: Names the technique
25 pts: Describes the result:
  - ReadOnlyRepository no longer extends Repository
  - It has a private Repository field (the delegate)
  - It implements a ReadRepository interface with only findById() and findAll()
  - PublicApiService is typed as ReadRepository<T>, not Repository<T>
  - save(), update(), delete() don't appear on ReadOnlyRepository at all
  - The bug is now a compile-time error, not a runtime error

Award 30/50 if they describe removing the inheritance and using composition
without naming Replace Superclass with Delegate.
Award 20/50 if they only say "don't extend Repository, use composition" without
describing the interface separation.

KEY INSIGHT for full marks: the fix doesn't just prevent the runtime error —
it makes the bug IMPOSSIBLE by removing the method from the public API.
The type system now enforces the read-only contract.
```

---

## PROBLEM 10 — "The Type Code Tangle"

| Field | Value |
|---|---|
| Slug | `the-type-code-tangle` |
| Difficulty | Hard |
| Category | `gof_creational` |
| Fowler Reference | Chapter 12: *Replace Type Code with Subclasses* (p. 362); Chapter 3: *Repeated Switches* |
| Primary Smell | Repeated Switches + Primitive Obsession (type field as string) |
| Primary Refactoring | Replace Type Code with Subclasses (p. 362), Factory Method |
| Tags | `type-code`, `replace-type-code-subclasses`, `factory-method`, `OCP`, `repeated-switches` |

### SCENARIO DESCRIPTION

```markdown
## The Shipping Carrier Maze

A logistics API integrates with three shipping carriers: `fedex`, `dhl`, and
`aramex`. The carrier is stored as a string field on the `Shipment` object, and
every service that touches shipments switches on this string.

When a fourth carrier (`smsa`) was added last month, the developer had to search
the codebase for every switch statement and update each one. Two were missed.
The SMSA tracking numbers were formatted incorrectly for two weeks before
a customer complained.

## Your Task

1. Identify the **two code smells** present (use Fowler's terminology).
2. Explain the specific risk this architecture creates when a new carrier is added.
3. Describe the refactoring in detail: what classes are created, what the factory
   looks like, which switch statements are eliminated and how. Name both Fowler
   techniques involved.
```

### PROBLEM FILES

**File 1: `Shipment.ts`**
```typescript
export interface Shipment {
  id: string;
  carrier: 'fedex' | 'dhl' | 'aramex';  // Primitive type code
  trackingNumber: string;
  weightKg: number;
  destinationCountry: string;
  isExpress: boolean;
}
```

**File 2: `ShipmentService.ts`**
```typescript
import { Shipment } from './Shipment';

export class ShipmentService {

  // Switch #1: Cost calculation per carrier
  calculateCost(shipment: Shipment): number {
    const baseRate = (() => {
      switch (shipment.carrier) {
        case 'fedex':  return shipment.weightKg * 8.5;
        case 'dhl':    return shipment.weightKg * 7.0;
        case 'aramex': return shipment.weightKg * 5.5;
        default: throw new Error(`Unknown carrier: ${shipment.carrier}`);
      }
    })();
    return shipment.isExpress ? baseRate * 1.5 : baseRate;
  }

  // Switch #2: Estimated delivery days per carrier + destination
  getEstimatedDeliveryDays(shipment: Shipment): number {
    switch (shipment.carrier) {
      case 'fedex':
        return shipment.destinationCountry === 'EG' ? 2 : 5;
      case 'dhl':
        return shipment.destinationCountry === 'EG' ? 3 : 6;
      case 'aramex':
        return shipment.destinationCountry === 'EG' ? 1 : 8;
      default:
        return 14;
    }
  }
}
```

**File 3: `TrackingService.ts`**
```typescript
import { Shipment } from './Shipment';

export class TrackingService {

  // Switch #3: Tracking URL per carrier
  getTrackingUrl(shipment: Shipment): string {
    switch (shipment.carrier) {
      case 'fedex':
        return `https://www.fedex.com/tracking?tracknumbers=${shipment.trackingNumber}`;
      case 'dhl':
        return `https://www.dhl.com/track?tracking-id=${shipment.trackingNumber}`;
      case 'aramex':
        return `https://www.aramex.com/track/results?ShipmentNumber=${shipment.trackingNumber}`;
      default:
        throw new Error(`Unknown carrier: ${shipment.carrier}`);
    }
  }

  // Switch #4: Tracking number format validation
  validateTrackingNumber(shipment: Shipment): boolean {
    switch (shipment.carrier) {
      case 'fedex':  return /^\d{12}$/.test(shipment.trackingNumber);
      case 'dhl':    return /^\d{10}$/.test(shipment.trackingNumber);
      case 'aramex': return /^\d{15}$/.test(shipment.trackingNumber);
      default:       return false;
    }
  }
}
```

**File 4: `ShipmentFormatter.ts`**
```typescript
import { Shipment } from './Shipment';

export class ShipmentFormatter {

  // Switch #5: Display label per carrier
  formatCarrierLabel(shipment: Shipment): string {
    switch (shipment.carrier) {
      case 'fedex':  return `FedEx® — ${shipment.trackingNumber}`;
      case 'dhl':    return `DHL Express — ${shipment.trackingNumber}`;
      case 'aramex': return `Aramex — ${shipment.trackingNumber}`;
      default:       return `Unknown Carrier — ${shipment.trackingNumber}`;
    }
  }
}
```

### SOLUTION FILES

**File 1: `Carrier.ts` (solution — abstract base)**
```typescript
// SOLUTION: Replace Type Code with Subclasses
// Each carrier becomes a class. The 5 switch statements become 5 abstract methods.
export abstract class Carrier {
  abstract readonly name: string;
  abstract readonly trackingNumberPattern: RegExp;

  abstract calculateBaseCost(weightKg: number): number;
  abstract getDeliveryDays(destinationCountry: string): number;
  abstract getTrackingUrl(trackingNumber: string): string;
  abstract formatLabel(trackingNumber: string): string;

  calculateCost(weightKg: number, isExpress: boolean): number {
    const base = this.calculateBaseCost(weightKg);
    return isExpress ? base * 1.5 : base;
  }

  validateTrackingNumber(trackingNumber: string): boolean {
    return this.trackingNumberPattern.test(trackingNumber);
  }
}
```

**File 2: `FedExCarrier.ts` (solution)**
```typescript
import { Carrier } from './Carrier';

export class FedExCarrier extends Carrier {
  readonly name = 'FedEx';
  readonly trackingNumberPattern = /^\d{12}$/;

  calculateBaseCost(weightKg: number): number { return weightKg * 8.5; }
  getDeliveryDays(destinationCountry: string): number {
    return destinationCountry === 'EG' ? 2 : 5;
  }
  getTrackingUrl(trackingNumber: string): string {
    return `https://www.fedex.com/tracking?tracknumbers=${trackingNumber}`;
  }
  formatLabel(trackingNumber: string): string { return `FedEx® — ${trackingNumber}`; }
}
```

**File 3: `CarrierFactory.ts` (solution)**
```typescript
import { Carrier } from './Carrier';
import { FedExCarrier } from './FedExCarrier';
// import { DHLCarrier } from './DHLCarrier';
// import { AramexCarrier } from './AramexCarrier';

type CarrierCode = 'fedex' | 'dhl' | 'aramex';

export class CarrierFactory {
  private static carriers: Map<CarrierCode, Carrier> = new Map([
    ['fedex',  new FedExCarrier()],
    // ['dhl',    new DHLCarrier()],
    // ['aramex', new AramexCarrier()],
  ]);

  static getCarrier(code: CarrierCode): Carrier {
    const carrier = this.carriers.get(code);
    if (!carrier) throw new Error(`Unknown carrier: ${code}`);
    return carrier;
  }

  // Adding SMSA: create SmsaCarrier.ts, add one line here. Zero other changes.
  static register(code: CarrierCode, carrier: Carrier): void {
    this.carriers.set(code, carrier);
  }
}
```

**File 4: `ShipmentService.ts` (solution)**
```typescript
import { Shipment } from './Shipment';
import { CarrierFactory } from './CarrierFactory';

export class ShipmentService {
  // Zero switch statements.
  calculateCost(shipment: Shipment): number {
    return CarrierFactory.getCarrier(shipment.carrier)
      .calculateCost(shipment.weightKg, shipment.isExpress);
  }

  getEstimatedDeliveryDays(shipment: Shipment): number {
    return CarrierFactory.getCarrier(shipment.carrier)
      .getDeliveryDays(shipment.destinationCountry);
  }
}
```

### RUBRIC

```
GRADING CRITERIA for "The Type Code Tangle":

TWO SMELLS (20 points, 10 each):
1. Repeated Switches (Fowler Ch. 3, p. 91) — the same carrier switch appears in 5 places
2. Primitive Obsession (Fowler Ch. 3, p. 88) — using a string 'fedex'/'dhl' where a
   proper Carrier type/class should exist

SPECIFIC RISK EXPLAINED (20 points):
Must describe: adding a new carrier (SMSA) requires finding ALL 5 switch statements
across 4 files and adding a case to each. Missing even one causes silent bugs
(wrong tracking URL, wrong format, wrong cost). The type system cannot help because
all switches have a `default` branch that either returns a fallback or throws at runtime.

PROPOSED FIX (60 points):
20 pts: Names "Replace Type Code with Subclasses" (Fowler p. 362) — each carrier
        becomes its own class implementing an abstract Carrier base.
20 pts: Describes the abstract class/interface with the 5 methods as abstract:
        calculateBaseCost(), getDeliveryDays(), getTrackingUrl(),
        validateTrackingNumber(), formatLabel()
20 pts: Describes the Factory — CarrierFactory.getCarrier('fedex') returns
        the right Carrier instance. OR describes a Registry pattern.

Adding SMSA now means: create SmsaCarrier.ts, register it. Zero changes to
ShipmentService, TrackingService, or ShipmentFormatter. This is the OCP in action.

KEY INSIGHT for full marks: the student explains that the switch statements
don't just become polymorphic method calls — they DISAPPEAR from all 4 service
files. The services call carrier.doX() without knowing which carrier it is.

Award 40/60 if they describe the subclass hierarchy without the Factory.
Award 20/60 if they only say "use polymorphism" without specifying which
methods become abstract or how the right subclass is selected.

DO NOT PASS if student only proposes a map of functions (a strategy-without-
classes approach) without explaining how it eliminates ALL 5 switch statements.
```

---

## APPENDIX: COMPLETE SQL SEED (ALL 10 PROBLEMS)

Run this in your Supabase SQL editor after the initial schema migration.
Replace the `solution_rubrics` and `problem_files` inserts with the content
from each problem section above.

```sql
-- ============================================================
-- ARCHLEET PROBLEM SEED — 10 OOP PROBLEMS
-- Problems map directly to Martin Fowler's Refactoring (2nd Ed.)
-- ============================================================

-- Problem slugs to insert (run each INSERT above per problem):
-- 1. the-billing-monolith         (Long Function / Split Phase)
-- 2. the-envious-calculator        (Feature Envy / Move Function)
-- 3. the-primitive-address         (Primitive Obsession / Introduce Parameter Object)
-- 4. the-repeated-switch           (Repeated Switches / Replace Conditional with Polymorphism)
-- 5. the-shotgun-discount          (Shotgun Surgery / Move Function)
-- 6. the-divergent-hr-manager      (Divergent Change / Extract Class)
-- 7. the-chain-gang                (Message Chains / Hide Delegate)
-- 8. the-hollow-product            (Data Class / Move Function)
-- 9. the-reluctant-heir            (Refused Bequest / Replace Superclass with Delegate)
-- 10. the-type-code-tangle         (Repeated Switches + Primitive Obsession / Replace Type Code)

-- Verify all problems were inserted:
SELECT slug, title, difficulty, category, order_index
FROM public.problems
WHERE slug IN (
  'the-billing-monolith', 'the-envious-calculator', 'the-primitive-address',
  'the-repeated-switch', 'the-shotgun-discount', 'the-divergent-hr-manager',
  'the-chain-gang', 'the-hollow-product', 'the-reluctant-heir', 'the-type-code-tangle'
)
ORDER BY order_index;

-- Verify rubrics exist:
SELECT p.slug, sr.passing_score
FROM public.solution_rubrics sr
JOIN public.problems p ON p.id = sr.problem_id
ORDER BY p.order_index;

-- Verify problem files:
SELECT p.slug, COUNT(pf.id) as file_count,
       SUM(CASE WHEN pf.is_solution = false THEN 1 ELSE 0 END) as problem_files,
       SUM(CASE WHEN pf.is_solution = true  THEN 1 ELSE 0 END) as solution_files
FROM public.problem_files pf
JOIN public.problems p ON p.id = pf.problem_id
GROUP BY p.slug
ORDER BY p.slug;
```

---

## FOWLER CHAPTER REFERENCE MAP

| Problem | Fowler Chapter | Pages | Smell → Refactoring |
|---|---|---|---|
| The Billing Monolith | Chapter 1 + 3 | 27–45, 73 | Long Function → Split Phase |
| The Envious Calculator | Chapter 3 + 8 | 84, 198 | Feature Envy → Move Function |
| The Primitive Address | Chapter 3 + 6 + 7 | 88, 140, 174 | Primitive Obsession → Replace Primitive with Object |
| The Repeated Switch | Chapter 3 + 10 | 91, 272, 362 | Repeated Switches → Polymorphism |
| The Shotgun Discount | Chapter 3 + 8 | 82, 198 | Shotgun Surgery → Move Function |
| The Divergent HR Manager | Chapter 3 + 7 | 78, 182 | Divergent Change → Extract Class |
| The Chain Gang | Chapter 3 + 7 | 98, 189 | Message Chains → Hide Delegate |
| The Hollow Product | Chapter 3 + 7 | 101, 198 | Data Class → Move Function |
| The Reluctant Heir | Chapter 3 + 12 | 102, 399 | Refused Bequest → Replace Superclass with Delegate |
| The Type Code Tangle | Chapter 3 + 12 | 91, 362 | Repeated Switches → Replace Type Code with Subclasses |

---

*End of ArchLeet OOP Problem Seed File*
*Source: Martin Fowler, Refactoring: Improving the Design of Existing Code, 2nd Ed. (2019)*
*All problems are original implementations inspired by Fowler's code smell catalog.*
