import { ContainerModule } from 'inversify';
import { KuksaWidget } from './kuksa-widget';
import { KuksaContribution } from './kuksa-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, KuksaContribution);
    bind(FrontendApplicationContribution).toService(KuksaContribution);
    bind(KuksaWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: KuksaWidget.ID,
        createWidget: () => ctx.container.get<KuksaWidget>(KuksaWidget)
    })).inSingletonScope();
});
