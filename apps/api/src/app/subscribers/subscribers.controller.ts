import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  CreateSubscriber,
  CreateSubscriberCommand,
  UpdateSubscriber,
  UpdateSubscriberCommand,
} from '@novu/application-generic';
import { RemoveSubscriber, RemoveSubscriberCommand } from './usecases/remove-subscriber';
import { JwtAuthGuard } from '../auth/framework/auth.guard';
import { ExternalApiAccessible } from '../auth/framework/external-api.decorator';
import { UserSession } from '../shared/framework/user.decorator';
import { ButtonTypeEnum, ChatProviderIdEnum, IJwtPayload } from '@novu/shared';
import {
  CreateSubscriberRequestDto,
  DeleteSubscriberResponseDto,
  SubscriberResponseDto,
  UpdateSubscriberChannelRequestDto,
  UpdateSubscriberRequestDto,
} from './dtos';
import {
  OAuthHandlerEnum,
  UpdateSubscriberChannel,
  UpdateSubscriberChannelCommand,
} from './usecases/update-subscriber-channel';
import { GetSubscribers, GetSubscribersCommand } from './usecases/get-subscribers';
import { GetSubscriber, GetSubscriberCommand } from './usecases/get-subscriber';
import { ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { GetPreferencesCommand } from './usecases/get-preferences/get-preferences.command';
import { GetPreferences } from './usecases/get-preferences/get-preferences.usecase';
import { UpdatePreference } from './usecases/update-preference/update-preference.usecase';
import { UpdateSubscriberPreferenceCommand } from './usecases/update-subscriber-preference';
import { UpdateSubscriberPreferenceResponseDto } from '../widgets/dtos/update-subscriber-preference-response.dto';
import { UpdateSubscriberPreferenceRequestDto } from '../widgets/dtos/update-subscriber-preference-request.dto';
import { MessageResponseDto, MessagesResponseDto } from '../widgets/dtos/message-response.dto';
import { UnseenCountResponse } from '../widgets/dtos/unseen-count-response.dto';
import { MessageEntity } from '@novu/dal';
import { MarkEnum, MarkMessageAsCommand } from '../widgets/usecases/mark-message-as/mark-message-as.command';
import { UpdateMessageActionsCommand } from '../widgets/usecases/mark-action-as-done/update-message-actions.command';
import { GetNotificationsFeedCommand } from '../widgets/usecases/get-notifications-feed/get-notifications-feed.command';
import { GetNotificationsFeed } from '../widgets/usecases/get-notifications-feed/get-notifications-feed.usecase';
import { MarkMessageAs } from '../widgets/usecases/mark-message-as/mark-message-as.usecase';
import { UpdateMessageActions } from '../widgets/usecases/mark-action-as-done/update-message-actions.usecase';
import { GetFeedCount } from '../widgets/usecases/get-feed-count/get-feed-count.usecase';
import { GetFeedCountCommand } from '../widgets/usecases/get-feed-count/get-feed-count.command';
import { UpdateSubscriberOnlineFlagRequestDto } from './dtos/update-subscriber-online-flag-request.dto';
import {
  UpdateSubscriberOnlineFlag,
  UpdateSubscriberOnlineFlagCommand,
} from './usecases/update-subscriber-online-flag';
import { MarkMessageAsRequestDto } from '../widgets/dtos/mark-message-as-request.dto';
import { MarkMessageActionAsSeenDto } from '../widgets/dtos/mark-message-action-as-seen.dto';
import { ApiOkPaginatedResponse } from '../shared/framework/paginated-ok-response.decorator';
import { PaginatedResponseDto } from '../shared/dtos/pagination-response';
import { GetSubscribersDto } from './dtos/get-subscribers.dto';
import { GetInAppNotificationsFeedForSubscriberDto } from './dtos/get-in-app-notification-feed-for-subscriber.dto';
import { ApiResponse } from '../shared/framework/response.decorator';
import { HandleCharOauth } from './usecases/handle-chat-oauth/handle-char-oauth.usecase';
import { HandleCharOauthCommand } from './usecases/handle-chat-oauth/handle-char-oauth.command';
import { HandleChatOauthRequestDto } from './dtos/handle-chat-oauth.request.dto';

@Controller('/subscribers')
@ApiTags('Subscribers')
export class SubscribersController {
  constructor(
    private createSubscriberUsecase: CreateSubscriber,
    private updateSubscriberUsecase: UpdateSubscriber,
    private updateSubscriberChannelUsecase: UpdateSubscriberChannel,
    private removeSubscriberUsecase: RemoveSubscriber,
    private getSubscriberUseCase: GetSubscriber,
    private getSubscribersUsecase: GetSubscribers,
    private getPreferenceUsecase: GetPreferences,
    private updatePreferenceUsecase: UpdatePreference,
    private getNotificationsFeedUsecase: GetNotificationsFeed,
    private genFeedCountUsecase: GetFeedCount,
    private markMessageAsUsecase: MarkMessageAs,
    private updateMessageActionsUsecase: UpdateMessageActions,
    private updateSubscriberOnlineFlagUsecase: UpdateSubscriberOnlineFlag,
    private handleCharOauthUsecase: HandleCharOauth
  ) {}

  @Get('')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiOkPaginatedResponse(SubscriberResponseDto)
  @ApiOperation({
    summary: 'Get subscribers',
    description: 'Returns a list of subscribers, could paginated using the `page` and `limit` query parameter',
  })
  async getSubscribers(
    @UserSession() user: IJwtPayload,
    @Query() query: GetSubscribersDto
  ): Promise<PaginatedResponseDto<SubscriberResponseDto>> {
    return await this.getSubscribersUsecase.execute(
      GetSubscribersCommand.create({
        organizationId: user.organizationId,
        environmentId: user.environmentId,
        page: query.page ? Number(query.page) : 0,
        limit: query.limit ? Number(query.limit) : 10,
      })
    );
  }

  @Get('/:subscriberId')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(SubscriberResponseDto)
  @ApiOperation({
    summary: 'Get subscriber',
    description: 'Get subscriber by your internal id used to identify the subscriber',
  })
  async getSubscriber(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string
  ): Promise<SubscriberResponseDto> {
    return await this.getSubscriberUseCase.execute(
      GetSubscriberCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId,
      })
    );
  }

  @Post('/')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(SubscriberResponseDto, 201)
  @ApiOperation({
    summary: 'Create subscriber',
    description:
      'Creates a subscriber entity, in the Novu platform. ' +
      'The subscriber will be later used to receive notifications, and access notification feeds. ' +
      'Communication credentials such as email, phone number, and 3 rd party credentials i.e slack tokens could be later associated to this entity.',
  })
  async createSubscriber(
    @UserSession() user: IJwtPayload,
    @Body() body: CreateSubscriberRequestDto
  ): Promise<SubscriberResponseDto> {
    return await this.createSubscriberUsecase.execute(
      CreateSubscriberCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId: body.subscriberId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        avatar: body.avatar,
        locale: body.locale,
        data: body.data,
      })
    );
  }

  @Put('/:subscriberId')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(SubscriberResponseDto)
  @ApiOperation({
    summary: 'Update subscriber',
    description: 'Used to update the subscriber entity with new information',
  })
  async updateSubscriber(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Body() body: UpdateSubscriberRequestDto
  ): Promise<SubscriberResponseDto> {
    return await this.updateSubscriberUsecase.execute(
      UpdateSubscriberCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        avatar: body.avatar,
        locale: body.locale,
        data: body.data,
      })
    );
  }

  @Put('/:subscriberId/credentials')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(SubscriberResponseDto)
  @ApiOperation({
    summary: 'Update subscriber credentials',
    description: 'Subscriber credentials associated to the delivery methods such as slack and push tokens.',
  })
  async updateSubscriberChannel(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Body() body: UpdateSubscriberChannelRequestDto
  ): Promise<SubscriberResponseDto> {
    return await this.updateSubscriberChannelUsecase.execute(
      UpdateSubscriberChannelCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId,
        providerId: body.providerId,
        credentials: body.credentials,
        oauthHandler: OAuthHandlerEnum.EXTERNAL,
      })
    );
  }

  @Patch('/:subscriberId/online-status')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(SubscriberResponseDto)
  @ApiOperation({
    summary: 'Update subscriber online status',
    description: 'Used to update the subscriber isOnline flag.',
  })
  async updateSubscriberOnlineFlag(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Body() body: UpdateSubscriberOnlineFlagRequestDto
  ): Promise<SubscriberResponseDto> {
    return await this.updateSubscriberOnlineFlagUsecase.execute(
      UpdateSubscriberOnlineFlagCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId,
        isOnline: body.isOnline,
      })
    );
  }

  @Delete('/:subscriberId')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(DeleteSubscriberResponseDto)
  @ApiOperation({
    summary: 'Delete subscriber',
    description: 'Deletes a subscriber entity from the Novu platform',
  })
  async removeSubscriber(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string
  ): Promise<DeleteSubscriberResponseDto> {
    return await this.removeSubscriberUsecase.execute(
      RemoveSubscriberCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        subscriberId,
      })
    );
  }

  @Get('/:subscriberId/preferences')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(UpdateSubscriberPreferenceResponseDto, 200, true)
  @ApiOperation({
    summary: 'Get subscriber preferences',
  })
  async getSubscriberPreference(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string
  ): Promise<UpdateSubscriberPreferenceResponseDto[]> {
    const command = GetPreferencesCommand.create({
      organizationId: user.organizationId,
      subscriberId: subscriberId,
      environmentId: user.environmentId,
    });

    return await this.getPreferenceUsecase.execute(command);
  }

  @Patch('/:subscriberId/preferences/:templateId')
  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @ApiResponse(UpdateSubscriberPreferenceResponseDto)
  @ApiOperation({
    summary: 'Update subscriber preference',
  })
  async updateSubscriberPreference(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Param('templateId') templateId: string,
    @Body() body: UpdateSubscriberPreferenceRequestDto
  ): Promise<UpdateSubscriberPreferenceResponseDto> {
    const command = UpdateSubscriberPreferenceCommand.create({
      organizationId: user.organizationId,
      subscriberId: subscriberId,
      environmentId: user.environmentId,
      templateId: templateId,
      ...(typeof body.enabled === 'boolean' && { enabled: body.enabled }),
      ...(body.channel && { channel: body.channel }),
    });

    return await this.updatePreferenceUsecase.execute(command);
  }

  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @Get('/:subscriberId/notifications/feed')
  @ApiOperation({
    summary: 'Get in-app notification feed for a particular subscriber',
  })
  @ApiOkPaginatedResponse(MessageResponseDto)
  async getNotificationsFeed(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Query() query: GetInAppNotificationsFeedForSubscriberDto
  ): Promise<PaginatedResponseDto<MessageResponseDto>> {
    let feedsQuery: string[] | undefined;
    if (query.feedIdentifier) {
      feedsQuery = Array.isArray(query.feedIdentifier) ? query.feedIdentifier : [query.feedIdentifier];
    }

    const command = GetNotificationsFeedCommand.create({
      organizationId: user.organizationId,
      environmentId: user.environmentId,
      subscriberId: subscriberId,
      page: query.page != null ? parseInt(query.page) : 0,
      feedId: feedsQuery,
      query: { seen: query.seen, read: query.read },
      limit: query.limit != null ? parseInt(query.limit) : 10,
    });

    return await this.getNotificationsFeedUsecase.execute(command);
  }

  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @Get('/:subscriberId/notifications/unseen')
  @ApiResponse(UnseenCountResponse)
  @ApiOperation({
    summary: 'Get the unseen in-app notifications count for subscribers feed',
  })
  async getUnseenCount(
    @UserSession() user: IJwtPayload,
    @Query('feedIdentifier') feedId: string[] | string,
    @Query('seen') seen: boolean,
    @Param('subscriberId') subscriberId: string
  ): Promise<UnseenCountResponse> {
    let feedsQuery: string[] | undefined;
    if (feedId) {
      feedsQuery = Array.isArray(feedId) ? feedId : [feedId];
    }

    const command = GetFeedCountCommand.create({
      organizationId: user.organizationId,
      subscriberId: subscriberId,
      environmentId: user.environmentId,
      feedId: feedsQuery,
      seen,
    });

    return await this.genFeedCountUsecase.execute(command);
  }

  @ExternalApiAccessible()
  @ApiExcludeEndpoint()
  @UseGuards(JwtAuthGuard)
  @Post('/:subscriberId/messages/:messageId/seen')
  @ApiOperation({
    summary: 'Mark a subscriber feed message as seen',
    description: 'This endpoint is deprecated please address /:subscriberId/messages/markAs instead',
    deprecated: true,
  })
  @ApiResponse(MessageResponseDto, 201)
  async markMessageAsSeen(
    @UserSession() user: IJwtPayload,
    @Param('messageId') messageId: string,
    @Param('subscriberId') subscriberId: string
  ): Promise<MessageEntity> {
    const messageIds = this.toArray(messageId);
    if (!messageIds) throw new BadRequestException('messageId is required');

    const command = MarkMessageAsCommand.create({
      organizationId: user.organizationId,
      environmentId: user.environmentId,
      subscriberId: subscriberId,
      messageIds,
      mark: { [MarkEnum.SEEN]: true },
    });

    return (await this.markMessageAsUsecase.execute(command))[0];
  }

  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @Post('/:subscriberId/messages/markAs')
  @ApiOperation({
    summary: 'Mark a subscriber feed message as seen',
  })
  @ApiResponse(MessageResponseDto, 201, true)
  async markMessageAs(
    @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Body() body: MarkMessageAsRequestDto
  ): Promise<MessageEntity[]> {
    if (!body.messageId) throw new BadRequestException('messageId is required');

    const messageIds = this.toArray(body.messageId);
    if (!messageIds) throw new BadRequestException('messageId is required');

    const command = MarkMessageAsCommand.create({
      organizationId: user.organizationId,
      subscriberId: subscriberId,
      environmentId: user.environmentId,
      messageIds,
      mark: body.mark,
    });

    return await this.markMessageAsUsecase.execute(command);
  }

  @ExternalApiAccessible()
  @UseGuards(JwtAuthGuard)
  @Post('/:subscriberId/messages/:messageId/actions/:type')
  @ApiOperation({
    summary: 'Mark message action as seen',
  })
  @ApiResponse(MessageResponseDto, 201)
  async markActionAsSeen(
    @UserSession() user: IJwtPayload,
    @Param('messageId') messageId: string,
    @Param('type') type: ButtonTypeEnum,
    @Body() body: MarkMessageActionAsSeenDto,
    @Param('subscriberId') subscriberId: string
  ): Promise<MessageResponseDto> {
    return await this.updateMessageActionsUsecase.execute(
      UpdateMessageActionsCommand.create({
        organizationId: user.organizationId,
        environmentId: user.environmentId,
        subscriberId: subscriberId,
        messageId,
        type,
        payload: body.payload,
        status: body.status,
      })
    );
  }

  @ExternalApiAccessible()
  @Get('/:subscriberId/:providerId/:environmentId')
  @ApiOperation({
    summary: 'Handle chat OAuth',
  })
  async chatAccessOauth(
    // @UserSession() user: IJwtPayload,
    @Param('subscriberId') subscriberId: string,
    @Param('providerId') providerId: string,
    @Param('environmentId') environmentId: string,
    @Query() query: HandleChatOauthRequestDto,
    @Res() res
  ): Promise<any> {
    const data = await this.handleCharOauthUsecase.execute(
      HandleCharOauthCommand.create({
        providerCode: query.code,
        environmentId,
        subscriberId,
        providerId: providerId as ChatProviderIdEnum,
      })
    );

    if (data.redirect) {
      res.redirect(data.action);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'");
      res.send(data.action);
    }
  }

  private toArray(param: string[] | string): string[] | undefined {
    let paramArray: string[] | undefined;
    if (param) {
      paramArray = Array.isArray(param) ? param : param.split(',');
    }

    return paramArray as string[];
  }
}
