import {
  CreateServerDockerComposeParams,
  DsgContext,
} from '@amplication/code-gen-types';
import { beforeCreateServerDockerCompose } from '@events/createDockerCompose';
import { mock } from 'jest-mock-extended';

describe('Testing beforeCreateServerDockeCompose hook', () => {
  let context: DsgContext;
  let eventParams: CreateServerDockerComposeParams;

  beforeEach(() => {
    context = mock<DsgContext>({
      pluginInstallations: [
        { npm: '@amplication/plugin-observability-opentelemetry' },
      ],
    });
    eventParams = mock<CreateServerDockerComposeParams>({
      updateProperties: [],
    });
  });

  it('should add required values to docker-compose.yml', () => {
    const { updateProperties } = beforeCreateServerDockerCompose(
      context,
      eventParams
    );

    expect(updateProperties[0]).toEqual({
      services: {
        server: {
          environment: {
            JAEGER_AGENT_HOST: '${JAEGER_AGENT_HOST}',
            JAEGER_AGENT_PORT: '${JAEGER_AGENT_PORT}',
            OTEL_COLLECTOR_HOST: '${OTEL_COLLECTOR_HOST}',
            OTEL_COLLECTOR_PORT_GRPC: '${OTEL_COLLECTOR_PORT_GRPC}',
            OTEL_COLLECTOR_PORT_HTTP: '${OTEL_COLLECTOR_PORT_HTTP}',
            OTEL_EXPORTER_OTLP_ENDPOINT: '${OTEL_EXPORTER_OTLP_ENDPOINT}',
          },
        },
        jaeger: {
          image: 'jaegertracing/all-in-one:latest',
          ports: [
            '${JAEGER_AGENT_PORT}:${JAEGER_AGENT_PORT}', // Jaeger agent UI
            '14268:14268',
            '14250:14250',
          ],
        },
        opentelemetry: {
          image: 'otel/opentelemetry-collector:latest',
          ports: [
            '${OTEL_COLLECTOR_PORT_GRPC}:${OTEL_COLLECTOR_PORT_GRPC}', // gRPC
            '${OTEL_COLLECTOR_PORT_HTTP}:${OTEL_COLLECTOR_PORT_HTTP}', // HTTP
            '1888:1888', // pprof extension
            '13133:13133', // health check extension
            '55670:55679', // zpages debugging extension
          ],
          volumes: ['./otel-config.yml:/etc/otel-config.yml'],
          command: ['--config=/etc/otel-config.yml'],
          depends_on: ['jaeger'],
        },
      },
    });
  });
});
