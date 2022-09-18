import {
  AmplicationPlugin,
  CreateMessageBrokerClientOptionsFactoryParams,
  CreateMessageBrokerNestJSModuleParams,
  CreateMessageBrokerParams,
  CreateMessageBrokerServiceBaseParams,
  CreateMessageBrokerServiceParams,
  CreateServerPackageJsonParams,
  CreateServerDockerComposeParams,
  CreateServerDotEnvParams,
  DsgContext,
  Events,
  Module,
} from "@amplication/code-gen-types";
import { readFile } from "fs/promises";
import { kebabCase, merge } from "lodash";
import { join, resolve } from "path";
import { staticDirectory } from "./constants";
class KafkaPlugin implements AmplicationPlugin {
  init?: ((name: string, version: string) => void) | undefined;
  register(): Events {
    return {
      CreateMessageBrokerClientOptionsFactory: {
        after: this.afterCreateMessageBrokerClientOptionsFactory,
      },
      CreateMessageBrokerNestJSModule: {
        after: this.afterCreateMessageBrokerNestJSModule,
      },
      CreateMessageBrokerService: {
        after: this.afterCreateMessageBrokerService,
      },
      CreateMessageBrokerServiceBase: {
        after: this.afterCreateMessageBrokerServiceBase,
      },
      CreateServerDotEnv: {
        before: this.beforeUpdateEnv,
      },
      CreatePackageJson: {
        before: this.beforeUpdateJson,
      },
      CreateMessageBroker: {
        before: this.beforeCreateBroker,
      },
      CreateServerDockerCompose: {
        before: this.beforeUpdateDockerCompose,
      },
    };
  }

  async afterCreateMessageBrokerClientOptionsFactory(
    context: DsgContext,
    eventParams: CreateMessageBrokerClientOptionsFactoryParams["after"]
  ): Promise<Module[]> {
    const { serverDirectories } = context;
    const templatePath = resolve(
      staticDirectory,
      "generateKafkaClientOptions.template.ts"
    );
    const template = await readFile(templatePath, "utf8");
    const generateFileName = "generateKafkaClientOptions.ts";

    const path = join(
      serverDirectories.messageBrokerDirectory,
      generateFileName
    );

    return [
      {
        code: template,
        path,
      },
    ];
  }

  beforeCreateBroker(
    dsgContext: DsgContext,
    eventParams: CreateMessageBrokerParams["before"]
  ): CreateMessageBrokerParams["before"] {
    dsgContext.serverDirectories.messageBrokerDirectory = join(
      dsgContext.serverDirectories.messageBrokerDirectory,
      "kafka"
    );
    return eventParams;
  }

  async afterCreateMessageBrokerNestJSModule(
    context: DsgContext,
    eventParams: CreateMessageBrokerNestJSModuleParams["after"]
  ) {
    const templatePath = resolve(staticDirectory, "kafka.module.template.ts");

    const { serverDirectories } = context;
    const { messageBrokerDirectory } = serverDirectories;
    const template = await readFile(templatePath, "utf8");
    const generateFileName = "kafka.module.ts";

    return [
      {
        code: template,
        path: join(messageBrokerDirectory, generateFileName),
      },
    ];
  }

  beforeUpdateEnv(
    context: DsgContext,
    eventParams: CreateServerDotEnvParams["before"]
  ): CreateServerDotEnvParams["before"] {
    const resourceName = context.resourceInfo?.name;
    if (!resourceName) {
      throw new Error("Resource name is missing");
    }
    const vars = {
      KAFKA_BROKERS: "localhost:9092",
      KAFKA_ENABLE_SSL: "false",
      KAFKA_CLIENT_ID: kebabCase(resourceName),
      KAFKA_GROUP_ID: kebabCase(resourceName),
    };
    const newEnvParams = [
      ...eventParams.envVariables,
      ...Object.entries(vars).map(([key, value]) => ({ [key]: value })),
    ];
    return { envVariables: newEnvParams };
  }

  beforeUpdateJson(
    context: DsgContext,
    eventParams: CreateServerPackageJsonParams["before"]
  ): CreateServerPackageJsonParams["before"] {
    const myValues = {
      dependencies: {
        "@nestjs/microservices": "^8.2.3",
        kafkajs: "^2.2.0",
      },
    };
    const newValues = merge(eventParams.updateValues, myValues);

    return { ...eventParams, updateValues: newValues };
  }

  async afterCreateMessageBrokerService(
    context: DsgContext,
    eventParams: CreateMessageBrokerServiceParams["after"]
  ): Promise<Module[]> {
    const { serverDirectories } = context;
    const { messageBrokerDirectory } = serverDirectories;
    const templatePath = resolve(staticDirectory, `kafka.service.template.ts`);

    const template = await readFile(templatePath, "utf8");
    const generateFileName = `kafka.service.ts`;

    const path = join(messageBrokerDirectory, generateFileName);
    return [{ code: template, path }];
  }
  async afterCreateMessageBrokerServiceBase(
    context: DsgContext,
    eventParams: CreateMessageBrokerServiceBaseParams["after"]
  ): Promise<Module[]> {
    const { serverDirectories } = context;
    const { messageBrokerDirectory } = serverDirectories;
    const templatePath = resolve(
      staticDirectory,
      `kafka.service.base.template.ts`
    );

    const template = await readFile(templatePath, "utf8");
    const generateFileName = `kafka.service.base.ts`;

    const path = join(messageBrokerDirectory, "base", generateFileName);
    return [{ code: template, path }];
  }

  beforeUpdateDockerCompose(
    dsgContext: DsgContext,
    eventParams: CreateServerDockerComposeParams["before"]
  ): CreateServerDockerComposeParams["before"] {
    const KAFKA_NAME = "kafka";
    const ZOOKEEPER_NAME = "zookeeper";
    const NETWORK = "internal";
    const ZOOKEEPER_PORT = "2181";
    const KAFKA_PORT = "9092";
    const newParams = {
      services: {
        [ZOOKEEPER_NAME]: {
          image: "confluentinc/cp-zookeeper:5.2.4",
          networks: [NETWORK],
          environment: {
            ZOOKEEPER_CLIENT_PORT: 2181,
            ZOOKEEPER_TICK_TIME: 2000,
          },
          ports: [`${ZOOKEEPER_PORT}:${ZOOKEEPER_PORT}`],
        },
        [KAFKA_NAME]: {
          image: "confluentinc/cp-kafka:5.3.1",
          networks: [NETWORK],
          depends_on: [ZOOKEEPER_NAME],
          ports: ["9092:9092", "9997:9997"],
          environment: {
            KAFKA_BROKER_ID: 1,
            KAFKA_ZOOKEEPER_CONNECT: `${ZOOKEEPER_NAME}:${ZOOKEEPER_PORT}`,
            KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://${KAFKA_NAME}:29092,PLAINTEXT_HOST://localhost:${KAFKA_PORT}`,
            KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: `PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT`,
            KAFKA_INTER_BROKER_LISTENER_NAME: `PLAINTEXT`,
            KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1,
            KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1,
            KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1,
          },
        },
      },
      networks: {
        internal: {
          name: NETWORK,
          driver: "bridge",
        },
      },
    };
    eventParams.updateProperties.push(newParams);
    return eventParams;
  }
}

export default KafkaPlugin;