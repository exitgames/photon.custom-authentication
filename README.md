Exit Games Photon - Custom Authentication
=========================================

This repository provides sample Custom Authentication Service implementations for the Exit Games Photon Cloud SaaS.

## Overview

When using the Exit Games Photon Cloud (Realtime, PUN, Voice, Chat, ...) to develop your application, you have the option of setting up custom authentication providers for your application. This way, you are able to authenticate your users against a number of authentication providers. This includes a custom authentication provider, that you can build and host yourself, so that you can do authentication against e.g. your own user database. This repository provides sample implementations of such a service.

You also want to have a look at the [documentation](https://doc.photonengine.com/en-us/realtime/current/connection-and-authentication/authentication/custom-authentication) of the feature.

## Authenticate Interface

You can set up an application with a HTTP(s) endpoint as your authentication provider. The URI of this service has to be configured in your application via your [dashboard](https://dashboard.photonengine.com/). This could e.g. be "https://auth.mycoolgame.com/".
The actual data used for the authentication (username, password, ...) has to be passed in by the client and will be forwarded to the authentication provider by the Photon server via HTTP GET. Have a look at the [documentation](https://doc.photonengine.com/en-us/realtime/current/connection-and-authentication/authentication/custom-authentication) for details.
For your production environment you should of course only use SSL connections!

How you handle the authentication internally is totally up to you.
The result has to be in Json format with the following values:

```json
{ ResultCode: 1, Message: "optional Auth OK message" }

{ ResultCode: 2, Message: "optional Auth Failed message" }

{ ResultCode: 3, Message: "optional Parameter invalid message" }
```

## Other Samples

You might also check out our [forum](https://forum.photonengine.com/) and discuss with others using the feature.
Topics to note:
* [About custom authentication - How to do it in PHP](https://forum.photonengine.com/discussion/2697/about-custom-authentication-how-to-do-it-in-php)
* [Custom Auth and Parse](https://forum.photonengine.com/discussion/comment/12815)
* [Basics of Custom Authentication? Resources?](https://forum.photonengine.com/discussion/2706/basics-of-custom-authentication-resources)
* [Facebook URL for Authentication?](https://forum.photonengine.com/discussion/comment/28855)
* [Any way to get the login message text from custom auth?](https://forum.photonengine.com/discussion/4891/any-way-to-get-the-login-message-text-from-custom-auth)
* [Custom Authentication Auth token pass thru](https://forum.photonengine.com/discussion/5854/custom-authentication-auth-token-pass-thru)

We will add some more samples, as soon as we find some time :)
