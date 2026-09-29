import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppLogger } from './common/logger/logger.service';
import {CryptoInterceptor} from './common/interceptors/crypto.interceptor';
import { TraceabilityInterceptor } from './common/interceptors/traceability.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true, // Habilita el almax  cenamiento en búfer de logs    
    });
    


    const appLogger = app.get(AppLogger);
    app.useLogger(appLogger); // Configura el logger globalmente

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // Remueve propiedades que no estén en el DTO
            forbidNonWhitelisted: true, // Lanza error si se envían propiedades no reconocidas
            transform: true, // Transforma automáticamente los payloads a instancias de sus DTOs
        }),
    );
    
    app.useGlobalInterceptors(
        app.get(TraceabilityInterceptor),
    );
    
    await app.listen(process.env.PORT ?? 3000);
    appLogger.log('Servidor iniciado exitosamente en el puerto ' + (process.env.PORT ?? 3000));
}

bootstrap().catch((error) => {
    console.error(error);
});
