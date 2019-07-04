import { ContainerModule } from 'inversify';
import { KuksaExtensionWidget } from './kuksa-extension-widget';
import { KuksaExtensionContribution } from './kuksa-extension-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, KuksaExtensionContribution);
    bind(FrontendApplicationContribution).toService(KuksaExtensionContribution);
    bind(KuksaExtensionWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: KuksaExtensionWidget.ID,
        createWidget: () => ctx.container.get<KuksaExtensionWidget>(KuksaExtensionWidget)
    })).inSingletonScope();
});
