import React from 'react';
import { ToneName } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { Card } from './Card';
import { IconTile } from './IconTile';
import { IconName } from './types';

/** Section card with an icon-tile heading. */
export const FormSection: React.FC<{ icon: IconName; title: string; tone?: ToneName; children: React.ReactNode; trailing?: React.ReactNode }> = ({
  icon,
  title,
  tone = 'indigo',
  children,
  trailing,
}) => (
  <Card style={{ marginBottom: 14 }}>
    <Row gap={10} style={{ marginBottom: 12 }}>
      <IconTile icon={icon} tone={tone} size={32} />
      <AppText variant="title" weight="extrabold" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {trailing}
    </Row>
    {children}
  </Card>
);
