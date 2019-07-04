import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';

@injectable()
export class KuksaExtensionWidget extends ReactWidget {

    static readonly ID = 'kuksa-extension:widget';
    static readonly LABEL = 'KuksaExtension Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = KuksaExtensionWidget.ID;
        this.title.label = KuksaExtensionWidget.LABEL;
        this.title.caption = KuksaExtensionWidget.LABEL;
        this.title.closable = true;
        this.update();
    }

    protected render(): React.ReactNode {
        const header = `This is a sample widget which simply calls the messageService
        in order to display an info message to end users.`;
        return <div id='widget-container'>
            <h2>{KuksaExtensionWidget.LABEL}</h2>
            <AlertMessage type='INFO' header={header} />
            <button className='secondary' title='Display Message' onClick={_a => this.displayMessage()}>Display Message</button>
        </div>
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: KuksaExtension Widget Successfully Created!');
    }



}
