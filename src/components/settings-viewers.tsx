'use client';

import {PresenceBadges, useViewers} from './admin-presence';

/** Client island so the server-rendered settings page can show live viewers. */
export default function SettingsViewers({resource, prefix = false, context}: {resource: string; prefix?: boolean; context: string}) {
  return <PresenceBadges viewers={useViewers(resource, {prefix})} context={context}/>;
}
