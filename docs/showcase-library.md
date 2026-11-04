# Counterintuitive Accounting Library

These are learning materials for future fmShowcase viewers in the gallery. There is one showcase idea per accounting fact that surprises learners. Each row gives the fact, why it puzzles people, how fmIDE and fmGraph could show it, and what the learner should take away. The owner gave the list on 3 November 2026 and asked for it to be documented only for now: nothing here is built or scheduled. Choosing which to make, and when, is the owner's decision.

The list has five levels of 20 items. Items 49–70 and 72 came later the same day, without a core learning objective; at the owner's request, Claude wrote those objectives in the style of the others. For them, the visualization column holds the owner's description of how to model the fact. Items 71 and 72 make nearly the same point: 71 as listed first, 72 as the owner gave it later.

## How a showcase is made from a row

The gallery's two sections so far show the way:
- **"From Zero to Dividend, step by step"** is made from the owner's own workspace by `gallery/makers/zero-to-dividend/`.
- **"Inventory: cash or credit"** is two minimal models built from scratch by `gallery/makers/cash-or-credit/`. Each has one slider, two periods side by side, the scenarios Cash and On credit, and the balance sheet, income statement and cash flow as charts.

Most Level 1 and Level 2 rows fit the second pattern:
- a minimal model of the one transaction;
- one slider, or two scenarios, for the choice that makes the difference;
- the three statements over the periods where the timing matters.

Each new section gets its own maker folder under `gallery/makers/`.

**The lessons maker** (`gallery/makers/lessons/`, 3 November 2026) makes one showcase per row from a short lesson file: the model as one-line formulas, the charts, one slider and its scenarios. It builds and lays out the model in fmIDE, fixes the scale from measurements, checks the viewer (balance checks, nothing past the scale's edge, Play, the workbook, no errors or outside requests) and publishes only when every lesson passes. Its README explains how to write the next lesson.

## The series roadmap (agreed 5 November 2026)

The gallery is organised as a course: journeys that follow one company step by step, with each step linking to the lessons (CA) whose surprise it shows and to its journal-entry pattern (JE). Each journey has its own Excel workbook.

| # | Series | What it covers | Status |
|---|---|---|---|
| 1 | From founding to dividend | One trading company's first year in 14 steps, and the whole year (FD01–FD15) | Live (5 November 2026) |
| 2 | The operating cycle | Year 2 of the same company (OC01–OC13): growth on credit and working capital, a warranty provision, a bad debt, a stock write-down, income tax; the bridge from profit to cash from operations | Live (5 November 2026) |
| 3 | Investing in other companies | Part 1 (IC01–IC15; IFRS, NCI at its share of net assets, the earlier stake re-measured on control): 10% (cost method), 30% (equity method), the re-measurement gain, control (consolidation, goodwill, non-controlling interest), the subsidiary's profit and dividend, a sale within the group, buying the rest, goodwill impairment. Part 2: losing control, a bargain purchase, a foreign subsidiary | Live (5 November 2026): part 1 IC01–IC15, part 2 IC16–IC20 |
| 4 | Long-term assets and financing | Year 3 of the same company (LF01–LF15): a machine on a new loan, depreciation, impairment, a disposal gain, a lease (asset, liability, interest, principal, depreciation), a loan settled at a discount, share issue and buyback, share-based pay; the bridge from profit to cash from operations | Live (5 November 2026) |
| 5 | From statements to value | The same company valued at the end of year 3 from a plan for years 4–8 (SV01–SV11): EBITDA to free cash flow, depreciation's tax shield, working capital, discounting, the terminal value, the discount rate, enterprise value to equity value, a dividend, a multiple, NPV against IRR, and the whole valuation. Teaching values: tax 25% of EBIT, a discount rate of 10%, terminal growth of 2% (enterprise value 1,481, equity value 1,654) | Live (5 November 2026) |
| 6 | Deals | A leveraged buyout (leverage and returns), EPS accretion or dilution, EPS against value created | Planned |
| 7 | Reading the statements | DuPont, liquidity against solvency, interest cover, quality of earnings, red flags | Planned |
| 8 | Industry models | SaaS, retail, project finance, real estate, banks | Idea |
| — | Counterintuitive accounting, Level 1 | CA01–CA20, one point each | Live |
| — | Counterintuitive accounting, Levels 2–5 | CA21–CA100, made as the journeys reach them | Planned |
| — | Journal entries: the 11 patterns | JE01–JE12 | Live |
| — | From Zero to Dividend (the owner's full model) | 01 Equity – 08 Dividend | Live, kept as "the full model" (the owner's decision, 5 November 2026) |

## Overlaps, and new items in their place (5 November 2026)

A review of the 100 items found points made more than once. Each overlap keeps its clearest item; the numbers freed take points the library was missing. Items keep their numbers, so links and videos stay valid.

| Overlap | Items | Kept | Number freed, and what goes there |
|---|---|---|---|
| Profit and cash on credit sales | 6, 22, 25 | 6, 22 | 25: Retained earnings are not cash |
| Buying and depreciating PPE | 10, 24, 34 | 10, 24 | 34: Revenue recognised over time: profit on a half-finished contract |
| Paying suppliers later | 26, 27, 32 | 26, 32 | 27: Warranty provisions: the expense now, the cash years later |
| Inventory and cash | 13, 28, 46, 54 | 13, 54 | 28: FIFO against average cost: the same goods, a different profit; 46: Other comprehensive income: equity moves without passing profit |
| EBITDA is not cash | 30, 31, 42 | 31, 42 | 30: Refinancing debt: no cash, yet a gain or a loss |
| CapEx and profit | 33, 41 | 41 | 33: Capitalised development or interest costs flatter profit |
| Dividends and losses | 9, 39 | 9 | 39: Share-based pay: an expense with no cash, and equity goes up |
| Discount rate and multiples | 71, 72 | 71 | 72: The cost method: a 10% stake earns only its dividends |
| Goodwill impairment is non-cash | 85, 86 | 85 | 86: The equity method: a share of the investee's profit is income with no cash; its dividends are cash with no income |
| Growth uses cash | 21, 61 | both | 21 reworded: growth ties cash up in receivables and inventory (working capital); 61 stays the forecast view |
| Expense before the bill | 15, 17 | both | 15 kept strictly as "no bill at all" (accrued wages) |

Foreign-currency translation (equity, not profit) is shown by IC19; it takes the next freed number when one comes free. The rows for the freed numbers are rewritten when their showcases are made.

## Already shown, in whole or in part

| No. | Shown by | How much |
|---|---|---|
| 1–20 | CA01–CA20, the section "Counterintuitive accounting, Level 1: fundamentals" | In full: one showcase per item, made by the lessons maker (3 November 2026; reworked to make each point only, 4 November 2026). Item 8 was "owner contributions are not revenue" until 5 November 2026, when CA07 took that point and 8 became bad debts. |
| 5, 11, 14 | Also Sale - cash or AR | The same points with inventory: cash of 100 against a profit of 10; revenue before the cash. |
| 12, 13 | Also Purchase - cash or AP | The purchase creates inventory, not an expense; paying the AP moves only cash. |
| 25, 26 | Sale - cash or AR, Purchase - cash or AP; 06 AR and 07 AP in Zero to Dividend | AR growth uses operating cash, and AP growth keeps it, in the cash flow waterfalls. |

## Level 1 — Accounting fundamentals (1–20)

| No. | Counterintuitive fact | Why it puzzles learners | Best fmIDE / fmGraph visualization | Core learning objective |
|---|---|---|---|---|
| 1 | Buying PPE with cash does not necessarily increase total assets | Cash decreases while PPE increases; learners may mistake an asset purchase for new wealth. | Before/after balance-sheet bars; cash-to-PPE animation | Asset exchange; total assets unchanged |
| 2 | Borrowing increases assets but not profit | Cash increases, but the company has also incurred a liability. | Accounting equation animation | Financing inflow is not revenue |
| 3 | Repaying loan principal reduces cash but not profit | Cash leaves the business, but principal repayment is not an expense. | Split debt-service waterfall | Principal repayment settles a liability |
| 4 | Customer deposits can increase cash without increasing revenue | Cash is received before the company has earned the revenue. | Timeline from deposit to revenue recognition | Cash receipt precedes performance |
| 5 | A cash sale is not all profit | The cash received includes recovery of the cost of goods sold, not just profit. | Two-entry sale animation; margin bridge | Revenue and cost of sales are different |
| 6 | A profitable company can have less cash | Profit includes non-cash items and timing differences in working capital. | Net income vs cash bridge | Accrual profit is not cash movement |
| 7 | A company can have cash without making a profit | Borrowing and capital contributions can generate cash without generating earnings. | Cash sources waterfall | Financing cash is not operating earnings |
| 8 | A sale can make a profit and bring in no cash: bad debts | Revenue is counted when the sale is made; if the customer never pays, the receivable becomes an expense and the cash never arrives. | Sale on credit, then the write-off; revenue, the bad debt and the cash received side by side | Revenue is earned at the sale; a bad debt takes the profit back without any cash ever moving |
| 9 | Dividends are generally not operating expenses | Cash is distributed, but the distribution is to owners rather than a cost of earning revenue. | Equity roll-forward and cash flow | Distribution to owners is not cost of earning revenue |
| 10 | Depreciation reduces profit without a current cash payment | Profit decreases even though no cash is paid when depreciation is recorded. | PPE roll-forward and indirect CFO bridge | Expense allocation differs from cash payment |
| 11 | Collecting receivables does not create new revenue | Cash increases, but the revenue was already recognized when the receivable arose. | AR-to-cash animation | Settlement of an existing asset |
| 12 | Paying accounts payable does not create a new expense | Cash decreases, but the expense was generally recognized when the liability arose. | AP-to-cash animation | Settlement of an existing liability |
| 13 | Buying inventory does not necessarily create an immediate expense | The purchase initially creates inventory, an asset, rather than an immediate expense. | Inventory lifecycle animation | Inventory is held as an asset until expensed |
| 14 | Revenue can be recognized before cash is received | Revenue may be earned while the customer still owes payment. | Revenue-to-cash timeline | Accrual recognition creates receivables |
| 15 | Expense can be recognized before cash is paid | An expense may be incurred before the supplier or employee is paid. | Accrual-to-payment timeline | Accrued liability records incurred cost |
| 16 | Prepaid insurance is not necessarily expensed immediately | The payment covers future periods, so part of it remains an asset. | Monthly prepaid-asset release | Future coverage is an asset |
| 17 | Receiving a bill does not mean cash has left | An invoice creates or confirms an obligation, but payment may happen later. | Invoice-to-payment timeline | Invoice and settlement are separate events |
| 18 | Equity is not the same as cash | Equity represents the residual interest in assets after liabilities, not the cash balance. | Balance sheet composition chart | Equity is the residual claim in the accounting equation |
| 19 | Assets can rise while equity stays unchanged | An asset purchase funded entirely by borrowing increases assets and liabilities equally. | A=L+E equation animation | Debt-funded asset acquisition |
| 20 | Double-entry does not mean every transaction affects two statements | Double-entry describes the accounting entries; financial statements are separate reporting classifications. | Highlight accounts and statement destinations | Accounts and statements are different classification layers |

## Level 2 — Working capital and cash flow (21–40)

| No. | Counterintuitive fact | Why it puzzles learners | Best fmIDE / fmGraph visualization | Core learning objective |
|---|---|---|---|---|
| 21 | Revenue growth can consume cash | Growth may require more receivables and inventory before customers pay. | Working-capital growth bridge | Revenue growth can increase working-capital funding needs |
| 22 | Positive net income can coexist with negative CFO | Profit can be recognized before cash collection, while working capital absorbs cash. | Net income-to-CFO waterfall | Net income and operating cash flow measure different things |
| 23 | A loss-making company can have positive CFO | Non-cash expenses and working-capital movements can support operating cash flow despite an accounting loss. | Net loss-to-CFO waterfall | Operating cash flow is not the same as accounting profit |
| 24 | Depreciation is added back in indirect CFO without being a cash inflow | The add-back reverses a non-cash expense included in net income; it does not represent cash received. | Indirect CFO reconciliation | The depreciation add-back is a reconciliation adjustment |
| 25 | Higher AR generally reduces CFO relative to profit | Revenue recognized but not yet collected increases receivables and reduces cash conversion. | AR movement and CFO bridge | An increase in receivables uses operating cash |
| 26 | Higher AP can temporarily increase CFO | Expenses or purchases may be recognized while payment is deferred. | AP movement and CFO bridge | An increase in payables temporarily preserves cash |
| 27 | Paying suppliers faster can reduce cash without changing current profit | Payment timing changes cash, not the expense already recognized. | AP settlement timeline | Payment timing and expense recognition are separate |
| 28 | Higher inventory can reduce CFO without immediately reducing profit | Cash is tied up in inventory before the inventory is sold and recognized as COGS. | Inventory movement and CFO bridge | Inventory investment can consume cash before affecting profit |
| 29 | Revenue and collections can move in opposite directions | Sales may increase while collection delays cause cash receipts to fall. | Revenue vs collections timeline | Revenue recognition and cash collection are distinct |
| 30 | EBITDA can rise while CFO falls | EBITDA excludes working-capital movements and other cash-flow timing effects. | EBITDA-to-CFO bridge | EBITDA does not capture working-capital cash movements |
| 31 | EBITDA is not cash flow | EBITDA excludes working capital, capital expenditure, interest, taxes and other cash movements. | EBITDA-to-FCF waterfall | EBITDA is an earnings measure, not a cash-flow measure |
| 32 | CFO can improve because payments are delayed | Delaying supplier payments preserves cash temporarily without necessarily improving underlying performance. | CFO bridge with payment-timing control | Cash-flow improvement may come from timing rather than sustainable operations |
| 33 | Investing cash outflows can rise while profit rises | Investment spending uses cash but is generally capitalized rather than expensed immediately. | CapEx and profit timeline | Investing cash flows and current-period expenses differ |
| 34 | Buying PPE and depreciating PPE are different events | The purchase is a cash investment; depreciation is the later allocation of its cost. | PPE roll-forward and cash-flow timeline | CapEx and depreciation are different accounting events |
| 35 | Asset disposal cash proceeds and accounting gain differ | The gain is measured against the asset's carrying amount, not the cash proceeds alone. | Disposal proceeds vs book value bridge | Disposal gain equals proceeds less carrying amount |
| 36 | Disposal gain is removed from indirect CFO | The gain is included in net income but the disposal proceeds are investing cash flow. | Net income-to-CFO reconciliation and disposal waterfall | Remove disposal gains from CFO to avoid double counting |
| 37 | Interest expense and interest paid can occur in different periods | Accrual accounting recognizes interest as incurred, while cash payment may occur later. | Interest accrual-to-payment timeline | Interest expense and interest payment have different timing |
| 38 | Tax paid can differ from tax expense | Tax expense is accrued, while cash tax payments follow tax payment schedules and settlements. | Tax expense vs tax paid bridge | Tax expense and cash taxes paid are different |
| 39 | Dividends can be paid in a loss year | Dividends are distributions of equity and cash, not expenses determined by current-year profit. | Equity roll-forward and dividend cash-flow timeline | Dividends are distributions, not operating expenses |
| 40 | A transaction can affect statements at different times | Recognition, invoicing, payment and settlement may occur in different accounting periods. | Multi-statement transaction timeline | Accounting recognition and cash settlement can occur at different times |

## Level 3 — Accounting judgments and performance (41–60)

| No. | Counterintuitive fact | Why it puzzles learners | Best fmIDE / fmGraph visualization | Core learning objective |
|---|---|---|---|---|
| 41 | CapEx can reduce current profit less than equivalent operating expense | Capital expenditure is initially recorded as an asset, while an operating expense is charged to profit immediately. | CapEx vs OpEx comparison; PPE roll-forward | Capitalization defers expense recognition over the asset's useful life |
| 42 | Higher depreciation can reduce NI while EBITDA stays unchanged | Depreciation is deducted in calculating operating profit and net income, but added back in EBITDA. | EBITDA-to-net-income bridge | EBITDA excludes depreciation and amortization |
| 43 | Extending useful life can raise reported profit without improving operations | A longer useful life reduces annual depreciation expense, increasing reported profit without changing cash generation. | Useful-life sensitivity and depreciation schedule | Depreciation estimates affect reported earnings |
| 44 | Impairment can reduce profit without a current cash outflow | The impairment charge reduces the carrying amount of an asset without requiring a contemporaneous payment. | Impairment waterfall; asset carrying-value roll-forward | Impairment is a non-cash accounting charge when recognized |
| 45 | A write-down can affect future reported margins | A lower inventory carrying value can change the cost recognized when inventory is subsequently sold. | Inventory write-down and future COGS timeline | Inventory valuation affects the timing and amount of reported profit |
| 46 | Inventory purchases and COGS are not interchangeable | Purchases add to inventory, while COGS reflects the cost of inventory sold during the period. | Inventory lifecycle; purchases-to-COGS bridge | COGS is recognized when inventory is sold |
| 47 | Gross profit can rise while unit economics deteriorate | Higher sales volume or mix can increase total gross profit even if profit per unit declines. | Unit economics and gross-profit bridge | Total gross profit and per-unit economics are different measures |
| 48 | Higher gross margin does not guarantee higher operating margin | Operating expenses below gross profit can rise enough to offset an improvement in gross margin. | Gross-to-operating-profit waterfall | Operating margin also depends on operating expenses |
| 49 | Higher sales volume can reduce profit if incremental unit economics are negative | Each additional sale can add more cost than revenue. | Set price below variable cost and increase volume | More volume adds profit only when the contribution per unit is positive |
| 50 | Fixed costs make profit more sensitive to sales changes than revenue is | Operating leverage magnifies changes in operating income. | Sweep volume around the break-even point | Operating leverage magnifies changes in profit relative to changes in revenue |
| 51 | Break-even revenue changes when the sales mix changes | Different products have different contribution margins. | Mix high- and low-margin products | Break-even depends on the weighted contribution margin of the sales mix |
| 52 | A company can have negative working capital and still operate successfully | Customer advances or fast cash collection can fund the operating cycle. | Compare a retailer with a manufacturer using the same ratios | Negative working capital can fund a healthy operating cycle |
| 53 | Negative working capital can also signal financial stress | Overdue payables or insufficient liquidity can produce the same headline metric. | Compare healthy negative working capital with a distressed case | Read working capital together with payment terms and liquidity, not alone |
| 54 | Reducing inventory can release cash without increasing revenue | Less capital is tied up in stock. | Reduce inventory days while holding sales constant | Less inventory releases cash without changing revenue |
| 55 | Factoring receivables may improve cash flow but does not automatically improve profitability | Proceeds depend on the structure; fees and derecognition treatment matter. | Compare collection, secured borrowing, and qualifying receivables sale | Factoring changes the timing of cash; its cost and accounting depend on the structure |
| 56 | Borrowing to fund a dividend can increase shareholder distributions without creating operating value | Cash and equity may decline while debt rises. | Compare levered and unlevered balance sheets and enterprise value | A debt-funded dividend moves funding from equity to debt without creating operating value |
| 57 | A debt repayment can improve leverage ratios but reduce liquidity | Debt falls alongside cash. | Track net debt, gross debt, and cash separately | Leverage and liquidity are different measures |
| 58 | Issuing shares can dilute ownership without diluting EPS in every case | The earnings generated by new capital may offset the higher share count. | Model proceeds, incremental earnings, and weighted-average shares | EPS dilution depends on the earnings the new capital generates |
| 59 | A share buyback can increase EPS without increasing total earnings | Fewer shares divide the same earnings. | Hold net income constant and reduce shares outstanding | A buyback raises EPS by reducing shares, not by increasing earnings |
| 60 | A company can have positive equity but still be unable to pay its bills | Solvency and short-term liquidity are different questions. | Contrast book equity with a 13-week cash forecast | Solvency and short-term liquidity are different questions |

## Level 4 — Financial modeling and valuation (61–80)

| No. | Counterintuitive fact | Why it puzzles learners | Best fmIDE / fmGraph visualization | Core learning objective |
|---|---|---|---|---|
| 61 | Growing revenue can reduce free cash flow even when margins stay constant | Growth requires investment in working capital and potentially CapEx. | Increase growth while holding margins constant; watch FCF | Growth needs working-capital and CapEx funding before it pays back |
| 62 | A profitable growth project can have negative cash flow for years | Upfront investment precedes the cash benefits. | Build a five-year project model with an initial cash outflow | Investment cash outflows come before the cash benefits |
| 63 | Higher CapEx can reduce FCF today but increase enterprise value | Investment can create future cash flows if returns justify the cost. | Compare growth CapEx with projected incremental FCF and NPV | Value depends on the returns from investment, not on current-period FCF |
| 64 | Cutting CapEx can improve short-term FCF while destroying long-term value | Underinvestment can impair capacity, efficiency, or competitiveness. | Compare maintenance investment with asset deterioration and future cash flows | Short-term FCF gains can destroy long-term value |
| 65 | Higher depreciation can increase FCF under certain tax assumptions | Depreciation's tax shield can reduce cash taxes. | Change depreciation while keeping the underlying asset economics constant | Depreciation affects cash only through its tax shield |
| 66 | A project with higher accounting profit can have a lower NPV | Timing and magnitude of cash flows matter more than accounting profit alone. | Compare two projects using both net income and discounted cash flows | Investment decisions rest on discounted cash flows, not accounting profit |
| 67 | A higher IRR doesn't necessarily mean a better investment | IRR ignores absolute scale and can mislead with unusual cash-flow patterns. | Compare a small high-IRR project with a larger positive-NPV project | Compare investments by NPV and scale, not by IRR alone |
| 68 | A positive NPV project can have negative accounting profit in its early years | Initial depreciation and financing structure can affect reported earnings. | Compare project NPV with annual P&L | The timing of accounting profit differs from project value |
| 69 | Extending a forecast horizon can increase valuation even without changing near-term results | More explicit forecast cash flows and terminal value can change the result. | Extend the forecast and isolate terminal-value contributions | The forecast horizon and terminal value shape a DCF result |
| 70 | A higher terminal growth rate can dominate a DCF valuation | Terminal value often represents a large portion of enterprise value. | Sweep perpetual growth and show terminal value as a share of EV | Terminal-value assumptions can dominate enterprise value |
| 71 | Higher discount rate does not mechanically lower every valuation multiple | Valuation multiples depend on growth, risk, cash-flow characteristics and other assumptions, not just the discount rate in isolation. | DCF and implied-multiple sensitivity | Valuation multiples are driven by multiple assumptions |
| 72 | A higher discount rate reduces the present value of future cash flows, but not necessarily every valuation multiple in every setting | Multiples also depend on growth, risk, returns, and accounting definitions. | Compare DCF sensitivity with implied trading multiples | Discount rates and valuation multiples respond to many assumptions, not one |
| 73 | EV can rise while equity value falls | Enterprise value and equity value respond differently to changes in net debt. | EV-to-equity-value bridge | Equity value equals enterprise value less net debt, subject to other adjustments |
| 74 | More excess cash can increase equity value without changing operating EV | Excess cash is generally added when bridging from enterprise value to equity value. | EV-to-equity-value bridge with cash sensitivity | Excess cash is a non-operating asset in the equity bridge |
| 75 | Dividend reduces cash/equity but does not mechanically reduce operating EV by the same amount | A dividend distributes cash to shareholders; it does not directly change the value of the underlying operations by the same amount. | Pre- and post-dividend EV/equity bridge | Distinguish operating enterprise value from equity value |
| 76 | Lower working-capital needs create value without revenue/EBITDA growth | Less cash tied up in working capital increases free cash flow even if operating earnings are unchanged. | Working-capital-to-FCF bridge | Working-capital efficiency can create value |
| 77 | Higher DPO can improve forecast FCF but may be unsustainable | Extending supplier payment periods temporarily releases cash but can damage supplier relationships or exceed normal terms. | DPO sensitivity and cash conversion cycle | Working-capital improvements must be operationally sustainable |
| 78 | Higher EBITDA multiple does not mean higher absolute EV | A higher multiple applied to a smaller EBITDA base can produce a lower enterprise value. | EBITDA vs multiple valuation matrix | Enterprise value depends on both EBITDA and the valuation multiple |
| 79 | EPS accretion does not prove acquisition value creation | An acquisition can increase EPS through financing or accounting effects without generating sufficient returns on the purchase price. | Acquisition EPS bridge vs ROIC/WACC analysis | EPS accretion is not equivalent to value creation |
| 80 | Higher ROE can result from leverage rather than better operations | More debt and less equity can increase ROE even if operating performance has not improved. | DuPont ROE decomposition | ROE must be understood through profitability, asset efficiency and leverage |

## Level 5 — Advanced accounting, consolidation and M&A (81–100)

| No. | Counterintuitive fact | Why it puzzles learners | Best fmIDE / fmGraph visualization | Core learning objective |
|---|---|---|---|---|
| 81 | Acquisition can increase consolidated assets without organic growth | The acquired company's assets enter the consolidated balance sheet even though the acquiring company's existing operations have not grown. | Pre- and post-acquisition consolidated balance sheet | Acquisition growth differs from organic growth |
| 82 | Acquisition can create goodwill even if target had no goodwill | Goodwill is calculated from the acquisition consideration and identifiable net assets, not simply carried over from the target's books. | Purchase price allocation waterfall | Goodwill arises from acquisition accounting |
| 83 | Acquisition can raise EBITDA but reduce EPS | Additional depreciation, amortization, interest expense and acquisition financing costs can outweigh the acquired earnings contribution. | Acquisition EBITDA-to-EPS bridge | EBITDA contribution does not guarantee EPS accretion |
| 84 | Bargain purchase can create a gain | When the fair value of identifiable net assets acquired exceeds the consideration, acquisition accounting may recognize a gain. | Purchase price allocation waterfall | Bargain purchase gains arise from acquisition-date measurement |
| 85 | Goodwill impairment reduces NI/equity without current cash outflow | The impairment reduces the carrying value of goodwill and reported earnings but does not require a current cash payment. | Goodwill roll-forward; impairment impact on three statements | Goodwill impairment is a non-cash accounting charge |
| 86 | Goodwill impairment is not a current-year cash payment equal to the charge | The impairment reflects a reduction in the accounting value of goodwill, rather than a payment made in the current period. | Impairment-to-CFO reconciliation | Distinguish impairment expense from cash expenditure |
| 87 | Consolidated revenue can rise while parent standalone revenue does not | Subsidiary revenue is included in consolidated accounts even when the parent itself records no corresponding standalone revenue. | Parent vs consolidated P&L comparison | Consolidated accounts include controlled subsidiaries |
| 88 | Intra-group sales disappear from consolidated revenue | Sales between entities in the same group are eliminated because the group is treated as one economic entity. | Consolidation elimination animation | Eliminate intra-group transactions on consolidation |
| 89 | Intra-group profit may be unrealized from group perspective | Profit on an intra-group sale is not realized by the group until the asset is sold to an external party. | Inventory consolidation elimination waterfall | Eliminate unrealized intra-group profit |
| 90 | A subsidiary can be consolidated below 100% ownership | Control, rather than full ownership, is the key basis for consolidation. | Ownership vs control diagram; consolidated balance sheet | Consolidation is based on control |
| 91 | More than 50% ownership does not always settle control analysis | Control depends on the relevant decision-making rights and circumstances, not solely on the percentage of shares owned. | Ownership and control decision tree | Assess control based on substantive rights and relevant facts |
| 92 | NCI can increase without parent issuing shares | Non-controlling interest represents the portion of a subsidiary's equity not attributable to the parent. | Consolidated equity roll-forward | NCI represents outside shareholders' interests in subsidiaries |
| 93 | Buying more shares in a controlled subsidiary may not create goodwill | An additional purchase of shares after control has already been obtained is generally treated as an equity transaction. | Before/after ownership and equity bridge | Changes in ownership without loss of control are equity transactions |
| 94 | Losing control can create gain/loss even if a stake is retained | Loss of control triggers a disposal accounting calculation, including remeasurement of any retained investment. | Loss-of-control disposal waterfall | Account for disposal and retained interest when control is lost |
| 95 | Lease can create asset and liability without large upfront payment | Lease commencement can recognize a right-of-use asset and lease liability without an equivalent initial cash outflow. | Lease commencement balance-sheet animation | Recognize right-of-use assets and lease liabilities |
| 96 | Lease accounting can change EBITDA without changing lease cash payments | Lease expense presentation can change under lease accounting even though the contractual cash payments remain the same. | EBITDA and lease-payment comparison | Lease accounting presentation affects EBITDA |
| 97 | Deferred tax expense can arise without current tax payment | Temporary differences can create deferred tax movements even when current-period cash taxes do not change. | Accounting profit vs taxable profit and deferred-tax bridge | Deferred tax reflects temporary differences |
| 98 | A deferred tax asset may not be fully realizable | Recognition depends on whether sufficient future taxable profit is probable or otherwise meets the applicable accounting requirements. | Deferred tax asset recognition sensitivity | Deferred tax assets depend on future recoverability |
| 99 | Identical cash economics can produce different reported earnings | Different accounting treatments and estimates can produce different reported results despite similar underlying cash flows. | Accounting treatment comparison; cash-flow reconciliation | Accounting presentation and economic cash flows are distinct |
| 100 | Reported performance can improve while economic position worsens | Accounting earnings can improve through timing, estimates or financing choices while cash generation, risk or underlying economics deteriorate. | Integrated three-statement model with earnings, cash and leverage indicators | Evaluate reported performance alongside cash flow and economic substance |
