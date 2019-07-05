import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import '@theia/terminal';

@injectable()
export class KuksaWidget extends ReactWidget {

    static readonly ID = 'kuksa:widget';
    static readonly LABEL = 'Kuksa Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = KuksaWidget.ID;
        this.title.label = KuksaWidget.LABEL;
        this.title.caption = KuksaWidget.LABEL;
        this.title.closable = true;
        this.update();
    }

    protected render(): React.ReactNode {
        const header = `This is a sample widget which simply calls the messageService
        in order to display an info message to end users.`;
        return <div id='widget-container'>
            <h2>{KuksaWidget.LABEL}</h2>
            <AlertMessage type='INFO' header={header} />
            <button className='secondary' title='Display Message' onClick={_a => this.displayMessage()}>Display Message</button>
        </div>
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: Kuksa Widget Successfully Created!');
    }



}
