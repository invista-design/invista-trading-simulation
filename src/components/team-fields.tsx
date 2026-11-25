import type { FieldErrors, TeamFormValues } from "@/server/teams";

function Field({
  name,
  label,
  type = "text",
  required,
  values,
  errors,
  hint,
  autoComplete,
  inputMode,
}: {
  name: keyof TeamFormValues;
  label: string;
  type?: string;
  required?: boolean;
  values?: TeamFormValues;
  errors?: FieldErrors;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email";
}) {
  const err = errors?.[name];
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={values?.[name] ?? ""}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${name}-err` : hint ? `${name}-hint` : undefined}
        className={`input ${err ? "border-down" : ""}`}
      />
      {err ? (
        <span id={`${name}-err`} className="mt-1 block text-xs text-down">
          {err}
        </span>
      ) : hint ? (
        <span id={`${name}-hint`} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** The 10 registration fields, shared by the public registration page and the admin panel. */
export function TeamFields({ values, errors }: { values?: TeamFormValues; errors?: FieldErrors }) {
  return (
    <div className="space-y-6">
      <Field name="teamName" label="Team name" required values={values} errors={errors} autoComplete="organization" hint="Your team logs in with this name, so keep it simple" />
      {([1, 2, 3] as const).map((i) => (
        <fieldset key={i} className="space-y-3">
          <legend className="mb-1 text-sm font-semibold">
            Team member {i}
            {i === 3 ? <span className="font-normal text-muted"> (optional: leave blank for a 2-member team)</span> : null}
          </legend>
          <Field name={`m${i}Name`} label="Full name" required={i < 3} values={values} errors={errors} autoComplete={i === 1 ? "name" : "off"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name={`m${i}Phone`} label="Contact number" type="tel" inputMode="tel" required={i < 3} values={values} errors={errors} autoComplete={i === 1 ? "tel" : "off"} hint="10-digit mobile number" />
            <Field name={`m${i}Email`} label="Email ID" type="email" inputMode="email" required={i < 3} values={values} errors={errors} autoComplete={i === 1 ? "email" : "off"} />
          </div>
        </fieldset>
      ))}
    </div>
  );
}
