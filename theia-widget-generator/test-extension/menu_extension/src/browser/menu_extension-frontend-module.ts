import { ContainerModule } from 'inversify';
import { Menu_extensionWidget } from './menu_extension-widget';
import { Menu_extensionContribution } from './menu_extension-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, Menu_extensionContribution);
    bind(FrontendApplicationContribution).toService(Menu_extensionContribution);
    bind(Menu_extensionWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: Menu_extensionWidget.ID,
        createWidget: () => ctx.container.get<Menu_extensionWidget>(Menu_extensionWidget)
    })).inSingletonScope();
});
