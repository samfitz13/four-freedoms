import { TabNav, TabNavLink } from "./tab-nav";

export function WorkspaceTabs({
  label,
  basePath,
  tabs,
  active,
  shortcuts = false,
}: {
  label: string;
  basePath: string;
  tabs: readonly { key: string; label: string }[];
  active: string;
  shortcuts?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <TabNav aria-label={`${label} sections`}>
        {tabs.map((tab, index) => (
          <TabNavLink
            key={tab.key}
            href={`${basePath}/${tab.key}`}
            replace
            scroll={false}
            active={active === tab.key}
            title={shortcuts ? `${tab.label} (press ${index + 1})` : tab.label}
          >
            {tab.label}
          </TabNavLink>
        ))}
      </TabNav>
    </div>
  );
}
