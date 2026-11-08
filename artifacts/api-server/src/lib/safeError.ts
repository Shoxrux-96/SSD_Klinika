// DB / dastur xatolarini client'ga chiqarishdan oldin "oddiylashtirish".
// Prod rejimida har qanday ichki detal yashirin — ichki xato → generik xabar.
// Dev rejimida (NODE_ENV !== "production") esa to'liq xatoning matni qaytadi.

type Err = { status?: number; code?: string; message?: string } | any;

const UNIQUE_RE = /duplicate key value violates unique constraint/i;
const FK_RE = /violates foreign key constraint/i;
const NOT_NULL_RE = /null value in column/i;
const CHECK_RE = /violates check constraint/i;

export function safeErrorMessage(e: Err, fallback: string): string {
  const raw = String(e?.message ?? "");
  if (UNIQUE_RE.test(raw)) return "Takroriy qiymat — bunday yozuv allaqachon mavjud";
  if (FK_RE.test(raw))     return "Bog'langan ma'lumotlar bilan ziddiyat";
  if (NOT_NULL_RE.test(raw)) return "Majburiy maydon to'ldirilmagan";
  if (CHECK_RE.test(raw))    return "Noto'g'ri qiymat";

  if (process.env.NODE_ENV === "production") return fallback;
  // Dev: aslida e.message qaytadi
  return raw || fallback;
}
