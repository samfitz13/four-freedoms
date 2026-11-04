import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppNav, FreedomNav } from "../../app/(app)/app-nav";
import { GlassToggle } from "../../components/ui/glass-toggle";
import { ThemeToggle } from "../../components/ui/theme-toggle";
import { Modal } from "../../components/ui/modal";
import { RowMenu, RowMenuItem } from "../../components/ui/row-menu";
import { DateInput } from "../../components/ui/date-input";
import { MoneyInput } from "../../components/ui/money-input";
import { InlineConfirmDelete } from "../../components/ui/inline-confirm-delete";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/field";
import { NativeSelect } from "../../components/ui/native-select";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { WorkspaceTabs } from "../../components/ui/workspace-tabs";
import { NewAccountForm } from "../../app/(app)/[freedom]/_financial/account-form";
import { AddHealthEntry } from "../../app/(app)/[freedom]/_health/health-forms";

globalThis.__qaPath = "/dashboard";

function Lab() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  const [deleted, setDeleted] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const [nested, setNested] = useState(false);
  return (
    <>
      <div className="daybreak-scene" aria-hidden />
      <div className="daybreak-shell">
        <header className="daybreak-shell-top">
          <span className="brand-mark">freedom / four</span>
          <div className="daybreak-appearance">
            <GlassToggle />
            <ThemeToggle />
          </div>
        </header>
        <div className="daybreak-shell-body">
          <aside className="daybreak-sidebar">
            <FreedomNav />
            <AppNav />
          </aside>
          <main className="daybreak-workspace flex flex-col gap-6">
            <header>
              <p className="eyebrow">Isolated synthetic fixtures</p>
              <h1 className="dashboard-title">The controls, in context.</h1>
            </header>
            <section className="daybreak-panel flex flex-col gap-5 p-6">
              <h2>Accounts</h2>
              <button className="daybreak-button self-start" onClick={() => setOpen(true)}>
                Open account dialog
              </button>
              <output aria-label="Saved count">{saved}</output>
              <div style={{ overflow: "hidden", height: 64, width: 180 }}>
                <RowMenu label="Sample row actions">
                  {(close) => (
                    <>
                      <RowMenuItem
                        onSelect={() => {
                          close();
                          setOpen(true);
                        }}
                      >
                        Edit sample
                      </RowMenuItem>
                      <RowMenuItem onSelect={close}>Close menu</RowMenuItem>
                    </>
                  )}
                </RowMenu>
              </div>
              <InlineConfirmDelete
                id="synthetic-row"
                action={async () => setDeleted((n) => n + 1)}
              />
              <output aria-label="Deleted count">{deleted}</output>
            </section>
            <section className="daybreak-panel p-6">
              <h2 className="mb-5">Dates and money</h2>
              <form id="field-test" className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  Sample date
                  <DateInput name="date" required defaultValue="2026-10-15" />
                </label>
                <MoneyInput name="amount" label="Sample amount" defaultValue={1234.56} />
              </form>
            </section>
            <section className="daybreak-panel p-6">
              <h2 className="mb-5">Health entry forms</h2>
              <AddHealthEntry />
            </section>
            <section className="daybreak-panel flex flex-col gap-4 p-6">
              <h2>Shared component checks</h2>
              <WorkspaceTabs
                label="Fixture"
                basePath="/financial"
                active="overview"
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "accounts", label: "Accounts" },
                ]}
              />
              <Button asChild>
                <a href="#field-test">Jump to fields</a>
              </Button>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted((n) => n + 1);
                }}
              >
                <Field label="Required menu value">
                  <Input id="menu-required" name="menuValue" required />
                </Field>
                <Field label="Shared selection">
                  <NativeSelect name="selection" defaultValue="second" required>
                    <option value="">Choose</option>
                    <option value="first">First</option>
                    <option value="second">Second</option>
                  </NativeSelect>
                </Field>
                <Field label="Shared notes">
                  <Textarea name="notes" maxLength={120} />
                </Field>
                <Button>Non-submitting button</Button>
                <RowMenu label="Form row actions">
                  {() => <RowMenuItem type="submit">Submit sample form</RowMenuItem>}
                </RowMenu>
              </form>
              <output aria-label="Menu submission count">{submitted}</output>
            </section>
            <Modal
              open={open}
              onClose={() => setOpen(false)}
              title="A home for an account"
              description="Synthetic fixture. No account or personal data is saved."
            >
              <NewAccountForm
                defaultCurrency="USD"
                onSuccess={() => {
                  setSaved((n) => n + 1);
                  setOpen(false);
                }}
              />
              <Field label="Dialog date">
                <DateInput name="dialog-date" defaultValue="2026-10-15" required />
              </Field>
              <InlineConfirmDelete
                id="synthetic-dialog-row"
                armLabel="Remove sample"
                confirmLabel="Remove sample?"
                action={async () => {}}
              />
              <RowMenu label="Dialog row actions">
                {(close) => (
                  <RowMenuItem
                    onSelect={() => {
                      close();
                      setNested(true);
                    }}
                  >
                    Open nested dialog
                  </RowMenuItem>
                )}
              </RowMenu>
              <Modal open={nested} onClose={() => setNested(false)} title="Nested sample">
                <Label htmlFor="nested-value">Nested value</Label>
                <Input id="nested-value" />
              </Modal>
            </Modal>
          </main>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Lab />);
